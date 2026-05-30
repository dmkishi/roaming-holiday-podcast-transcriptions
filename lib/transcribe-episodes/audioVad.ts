import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import { decodePcm } from '@lib/transcribe-episodes/audioPcm.js';
import { hasVad, paths, writeVad } from '@lib/shared/artifacts.js';
import { VENV_PYTHON, VAD_SCRIPT } from '@lib/shared/paths.js';
import { VadOutputSchema } from '@lib/shared/schemas.js';
import { MIN_GAP_SECONDS } from '@lib/config/audio.js';

export interface Gap {
  start: number;
  end: number;
  duration: number;
}

type VadResult =
  | { ok: true; status: 'generated'; episodeNumber: number; path: string }
  | { ok: true; status: 'alreadyExists'; episodeNumber: number; path: string };

type VadResponse = FailResponse | VadResult;

// eslint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);

/**
 * Run Silero VAD on an episode MP3 to list speech intervals and gaps. Writes
 * the result to `<code>.audio-vad.json`. Skips if the file already exists
 * (unless the `force` option is true.)
 */
export async function runVad(
  episodeNumber: number,
  mp3Path: string,
  force: boolean,
): Promise<VadResponse> {
  try {
    if (!force && hasVad(episodeNumber)) {
      return {
        ok: true,
        status: 'alreadyExists',
        episodeNumber,
        path: paths(episodeNumber).vad,
      };
    }

    const pcmPath = await decodePcm(mp3Path);
    const { audioDuration, speechIntervals } = await detectSpeechIntervals(pcmPath);

    const vadPath = writeVad(episodeNumber, {
      duration: audioDuration,
      speech: speechIntervals,
      gaps: gapsFromSpeech(speechIntervals, audioDuration, MIN_GAP_SECONDS),
    });

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
