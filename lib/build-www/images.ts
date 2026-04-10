import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_EPISODES_IMG_DIR } from '@lib/config/paths.js';
import { formatEpisodeNumber } from '@lib/shared/paths.js';

export type ImageResponse =
  | { status: 'downloaded' | 'alreadyExists'; path: string }
  | { status: 'failed'; path: string; error: string };

/**
 * Downloads an episode cover image from the given URL and saves it to the site
 * image directory. Skips the download if it already exists.
 */
export async function downloadImage(
  episodeNumber: number,
  imageUrl: string,
): Promise<ImageResponse> {
  const filename = `${formatEpisodeNumber(episodeNumber)}.jpg`;
  const relPath = `img/episodes/${filename}`;
  const destPath = join(SITE_EPISODES_IMG_DIR, filename);

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
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
