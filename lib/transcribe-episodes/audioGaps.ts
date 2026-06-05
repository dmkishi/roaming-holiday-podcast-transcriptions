import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FailResponse } from '#lib/transcribe-episodes/types.ts';
import { decodePcm } from '#lib/transcribe-episodes/audioPcm.ts';
import { hasGaps, paths, writeGaps } from '#lib/shared/artifacts.ts';
import { VENV_PYTHON, VAD_SCRIPT } from '#lib/shared/paths.ts';
import { VadOutputSchema } from '#lib/shared/schemas.ts';
import { MIN_GAP_SECONDS } from '#lib/config/audio.ts';

export interface Gap {
  start: number;
  end: number;
  duration: number;
}

type GapsResponse =
  | FailResponse
  | { ok: true; status: 'generated'; episodeNumber: number; path: string }
  | { ok: true; status: 'alreadyExists'; episodeNumber: number; path: string };

// eslint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);

/**
 * Detect audio gaps in an episode MP3 and write them to `<code>.audio-gaps.json`.
 * Skips if the file already exists (unless the `force` option is true.)
 */
export async function detectGaps(
  episodeNumber: number,
  mp3Path: string,
  force: boolean,
): Promise<GapsResponse> {
  try {
    if (!force && hasGaps(episodeNumber)) {
      return {
        ok: true,
        status: 'alreadyExists',
        episodeNumber,
        path: paths(episodeNumber).gaps,
      };
    }

    const pcmPath = await decodePcm(mp3Path);
    const { pcmSeconds, speechIntervals } = await detectSpeechIntervals(pcmPath);

    const gapsPath = writeGaps(episodeNumber, {
      // Measured PCM length, the source of truth for chunk math. The RSS
      // `itunes:duration` (whole-second, sometimes inaccurate) can disagree
      // with the actual audio and isn't consistent with the gaps below.
      pcmSeconds,
      gaps: findGapsOverThreshold(speechIntervals, pcmSeconds, MIN_GAP_SECONDS),
    });

    return {
      ok: true,
      status: 'generated',
      episodeNumber,
      path: gapsPath,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run Silero VAD on a PCM file and return the file's total duration and the
 * start/end timestamps of detected speech intervals.
 */
export async function detectSpeechIntervals(
  pcmPath: string,
): Promise<{
  pcmSeconds: number;
  speechIntervals: { start: number; end: number }[];
}> {
  const { stdout } = await execFileAsync(VENV_PYTHON, [VAD_SCRIPT, pcmPath]);
  const { duration, speech } = VadOutputSchema.parse(JSON.parse(stdout));
  return { pcmSeconds: duration, speechIntervals: speech };
}

/**
 * Compute the gaps between speech intervals over a given threshold duration.
 */
export function findGapsOverThreshold(
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
