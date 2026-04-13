import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { episodePaths } from '@lib/transcribe-episodes/paths.js';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import { TMP_DIR, VENV_PYTHON, VAD_SCRIPT, FFMPEG } from '@lib/shared/paths.js';
import { VadFileSchema, VadOutputSchema } from '@lib/shared/schemas.js';
import { toPrettyJson } from '@lib/shared/strings.js';

export interface Gap {
  start: number;
  end: number;
  duration: number;
}

export type VadResult =
  | { ok: true; status: 'generated'; episodeNumber: number; path: string }
  | { ok: true; status: 'alreadyExists'; episodeNumber: number; path: string };

export type VadResponse = FailResponse | VadResult;

const execFileAsync = promisify(execFile);

/** Minimum non-speech duration (seconds) to count as a gap. */
export const MIN_GAP_SECONDS = .4;

// -----------------------------------------------------------------------------
// Orchestrator
// -----------------------------------------------------------------------------
/**
 * Run Silero VAD on an episode MP3 to list speech intervals and gaps. Writes
 * the result to `<code>.vad.json`. Skips if the file already exists (unless
 * the `force` option is true.)
 */
export async function runVad(
  episodeNumber: number,
  mp3Path: string,
  force: boolean,
): Promise<VadResponse> {
  try {
    const { vad: vadPath } = episodePaths({ episodeNumber, model: '' });

    if (!force && existsSync(vadPath)) {
      return {
        ok: true,
        status: 'alreadyExists',
        episodeNumber,
        path: vadPath,
      };
    }

    const pcmPath = await decodePcm(mp3Path);
    const { audioDuration, speechIntervals } = await detectSpeechIntervals(pcmPath);

    mkdirSync(dirname(vadPath), { recursive: true });
    writeFileSync(vadPath, toPrettyJson(VadFileSchema.parse({
      duration: audioDuration,
      speech: speechIntervals,
      gaps: gapsFromSpeech(speechIntervals, audioDuration, MIN_GAP_SECONDS),
    })));

    return {
      ok: true,
      status: 'generated',
      episodeNumber,
      path: vadPath,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// -----------------------------------------------------------------------------
// Pure functions
// -----------------------------------------------------------------------------
/**
 * Given speech intervals and total duration, return non-speech gaps of at
 * least `minGapSeconds`.
 */
export function gapsFromSpeech(
  speech: readonly { start: number; end: number }[],
  totalDuration: number,
  minGapSeconds: number,
): Gap[] {
  const gaps: Gap[] = [];

  if (speech.length > 0 && speech[0]!.start > 0) {
    const duration = speech[0]!.start;
    if (duration >= minGapSeconds) {
      gaps.push({ start: 0, end: speech[0]!.start, duration });
    }
  }

  for (let i = 0; i < speech.length - 1; i++) {
    const gapStart = speech[i]!.end;
    const gapEnd = speech[i + 1]!.start;
    const duration = gapEnd - gapStart;
    if (duration >= minGapSeconds) {
      gaps.push({ start: gapStart, end: gapEnd, duration });
    }
  }

  if (speech.length > 0 && speech.at(-1)!.end < totalDuration) {
    const gapStart = speech.at(-1)!.end;
    const duration = totalDuration - gapStart;
    if (duration >= minGapSeconds) {
      gaps.push({ start: gapStart, end: totalDuration, duration });
    }
  }

  if (speech.length === 0 && totalDuration > 0) {
    gaps.push({ start: 0, end: totalDuration, duration: totalDuration });
  }

  return gaps;
}

// -----------------------------------------------------------------------------
// I/O helpers
// -----------------------------------------------------------------------------
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
 * Run Silero VAD on a PCM file and return total duration and speech intervals.
 */
export async function detectSpeechIntervals(
  pcmPath: string,
): Promise<{
  audioDuration: number;
  speechIntervals: { start: number; end: number }[];
}> {
  const { stdout } = await execFileAsync(VENV_PYTHON, [VAD_SCRIPT, pcmPath]);
  const { duration, speech } = VadOutputSchema.parse(JSON.parse(stdout));
  return { audioDuration: duration, speechIntervals: speech };
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
