import { execFile } from 'node:child_process';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { TMP_DIR, FFMPEG } from '@lib/shared/paths.js';

const execFileAsync = promisify(execFile);

/**
 * Decode the source MP3 to 16 kHz mono s16le PCM at `/tmp/<base>.pcm`.
 */
export async function decodePcm(mp3Path: string): Promise<string> {
  await checkFfmpegInstalled();

  const pcmPath = join(TMP_DIR, `${tmpBase(mp3Path)}.pcm`);
  await execFileAsync(FFMPEG, [
    '-y', '-i', mp3Path,
    '-ac', '1', '-ar', '16000', '-f', 's16le',
    pcmPath,
  ]);
  return pcmPath;
}

/**
 * Verify that ffmpeg is available on PATH.
 */
async function checkFfmpegInstalled(): Promise<void> {
  try {
    await execFileAsync(FFMPEG, ['-version']);
  } catch {
    throw new Error(
      'ffmpeg not found on PATH.\n' +
      'Install it: brew install ffmpeg',
    );
  }
}

function tmpBase(mp3Path: string): string {
  return basename(mp3Path).replace(/\.[^.]+$/, '');
}
