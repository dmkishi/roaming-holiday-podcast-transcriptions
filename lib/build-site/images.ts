import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST_IMG_DIR } from '@lib/config/paths.js';
import { formatEpisodeNumber } from '@lib/shared/paths.js';

export async function downloadImage(
  episodeNumber: number,
  imageUrl: string,
): Promise<string> {
  const filename = `${formatEpisodeNumber(episodeNumber)}.jpg`;
  const destPath = join(DIST_IMG_DIR, filename);

  if (existsSync(destPath)) return `img/${filename}`;

  mkdirSync(DIST_IMG_DIR, { recursive: true });

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.warn(`[images] Failed to download image for episode ${episodeNumber}: ${res.status}`);
      return `img/${filename}`;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buffer);
  } catch (error) {
    console.warn(`[images] Error downloading image for episode ${episodeNumber}: ${String(error)}`);
  }

  return `img/${filename}`;
}
