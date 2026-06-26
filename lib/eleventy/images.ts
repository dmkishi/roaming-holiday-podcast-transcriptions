import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { errorMessage } from '#lib/shared/errors.ts';
import { SITE_DIR, SITE_EPISODES_IMG_DIR } from '#lib/shared/paths.ts';
import { formatEpisodeNumber } from '#lib/shared/strings.ts';

type ImageResponse =
  | { status: 'downloaded' | 'alreadyExists'; path: string }
  | { status: 'failed'; path: string; error: string };

/**
 * Deterministic site-relative path to an episode's cover image, e.g.
 * `img/episodes/001.jpg`. Shared by `buildEpisodes` (which needs only the path)
 * and `downloadImage` (which writes the file) so the two never drift.
 */
export function episodeImagePath(episodeNumber: number): string {
  const filename = `${formatEpisodeNumber(episodeNumber)}.jpg`;
  return relative(SITE_DIR, join(SITE_EPISODES_IMG_DIR, filename));
}

/**
 * Downloads an episode cover image from the given URL and saves it to the site
 * image directory. Skips the download if it already exists.
 */
export async function downloadImage(
  episodeNumber: number,
  imageUrl: string,
): Promise<ImageResponse> {
  const relPath = episodeImagePath(episodeNumber);
  const destPath = join(SITE_DIR, relPath);

  if (existsSync(destPath)) {
    return { status: 'alreadyExists', path: relPath };
  }

  mkdirSync(SITE_EPISODES_IMG_DIR, { recursive: true });

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      return { status: 'failed', path: relPath, error: `HTTP ${res.status}` };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buffer);
    return { status: 'downloaded', path: relPath };
  } catch (error) {
    return {
      status: 'failed',
      path: relPath,
      error: errorMessage(error),
    };
  }
}
