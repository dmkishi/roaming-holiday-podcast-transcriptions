import { createWriteStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { SingleBar, Presets } from 'cli-progress';
import pc from 'picocolors';

const BYTES_PER_MB = 1024 * 1024;

/**
 * Downloads a podcast episode MP3 to `/tmp`, showing a progress bar. Skips the
 * download if a file with a matching size already exists.
 *
 * @returns File path to the downloaded MP3.
 */
export async function downloadMp3(
  mp3Url: string,
  episodeNumber: number,
): Promise<string> {
  const destPath = `/tmp/RH${String(episodeNumber).padStart(4, '0')}.mp3`;

  const response = await fetch(mp3Url);
  if (!response.ok) {
    throw new Error(`Failed to download MP3: HTTP ${response.status} from ${mp3Url}`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);

  try {
    const stat = statSync(destPath);
    if (contentLength > 0 && stat.size === contentLength) {
      // Skip download if file already exists with matching size.
      const sizeMB = Math.round(stat.size / BYTES_PER_MB);
      console.log(pc.yellow(`Already downloaded: "${destPath}" (${sizeMB} MB)`));
      return destPath;
    }
  } catch {
    // File doesn't exist, proceed with download.
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const totalMB = contentLength / BYTES_PER_MB;
  const bar = new SingleBar(
    {
      format: 'Downloading [{bar}] {percentage}% | {value}/{total} MB',
    },
    Presets.shades_classic,
  );

  if (contentLength > 0) {
    bar.start(Math.round(totalMB * 10) / 10, 0);
  } else {
    bar.start(0, 0);
  }

  const fileStream = createWriteStream(destPath);
  const readable = Readable.fromWeb(response.body as import('stream/web').ReadableStream);

  let downloaded = 0;
  for await (const chunk of readable) {
    fileStream.write(chunk);
    downloaded += (chunk as Buffer).length;
    const downloadedMB = Math.round((downloaded / BYTES_PER_MB) * 10) / 10;
    if (contentLength > 0) {
      bar.update(downloadedMB);
    } else {
      bar.update({ value: downloadedMB, total: downloadedMB });
    }
  }

  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
    fileStream.end();
  });

  bar.stop();

  const sizeMB = Math.round(downloaded / BYTES_PER_MB);
  console.log(`Downloaded: ${destPath} (${sizeMB} MB)`);
  return destPath;
}
