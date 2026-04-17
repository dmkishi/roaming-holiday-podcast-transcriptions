import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import { decodePcm } from '@lib/transcribe-episodes/audioPcm.js';
import { hasFade, paths, writeFade } from '@lib/shared/artifacts.js';
import { VENV_PYTHON, FADE_SCRIPT } from '@lib/shared/paths.js';
import { FadeOutputSchema } from '@lib/shared/schemas.js';
import {
  FADE_FRAME_SIZE,
  FADE_HOP_SIZE,
  FADE_CUTOFF_HIGH,
  FADE_CUTOFF_LOW,
  FADE_MIN_LENGTH_SECONDS,
} from '@lib/config/audio.js';

export type FadeResult =
  | { ok: true; status: 'generated'; episodeNumber: number; path: string }
  | { ok: true; status: 'alreadyExists'; episodeNumber: number; path: string };

export type FadeResponse = FailResponse | FadeResult;

const execFileAsync = promisify(execFile);

// -----------------------------------------------------------------------------
// Orchestrator
// -----------------------------------------------------------------------------
/**
 * Run Essentia fade detection on an episode MP3 to list music fade-in/fade-out
 * spans. Writes the result to `<code>.fade.json`. Skips if the file already
 * exists (unless the `force` option is true.)
 */
export async function runFade(
  episodeNumber: number,
  mp3Path: string,
  force: boolean,
): Promise<FadeResponse> {
  try {
    if (!force && hasFade(episodeNumber)) {
      return {
        ok: true,
        status: 'alreadyExists',
        episodeNumber,
        path: paths(episodeNumber).fade,
      };
    }

    const pcmPath = await decodePcm(mp3Path);
    const { duration, fades } = await detectFades(pcmPath);

    const fadePath = writeFade(episodeNumber, { duration, fades });

    return {
      ok: true,
      status: 'generated',
      episodeNumber,
      path: fadePath,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// -----------------------------------------------------------------------------
// I/O helpers
// -----------------------------------------------------------------------------
/**
 * Run Essentia FadeDetection on a PCM file and return duration and fade spans.
 */
export async function detectFades(
  pcmPath: string,
): Promise<{
  duration: number;
  fades: { start: number; end: number; type: 'in' | 'out' }[];
}> {
  const { stdout } = await execFileAsync(VENV_PYTHON, [
    FADE_SCRIPT,
    pcmPath,
    '--frame-size', String(FADE_FRAME_SIZE),
    '--hop-size', String(FADE_HOP_SIZE),
    '--cutoff-high', String(FADE_CUTOFF_HIGH),
    '--cutoff-low', String(FADE_CUTOFF_LOW),
    '--min-length', String(FADE_MIN_LENGTH_SECONDS),
  ]);
  return FadeOutputSchema.parse(JSON.parse(stdout));
}
