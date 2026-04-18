import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import { decodePcm } from '@lib/transcribe-episodes/audioPcm.js';
import { hasFade, paths, writeFade } from '@lib/shared/artifacts.js';
import { VENV_PYTHON, FADE_SCRIPT } from '@lib/shared/paths.js';
import { FadeSpansSchema, type FadeSpan, type FadePair } from '@lib/shared/schemas.js';
import {
  FADE_PAIR_MAX_GAP_SECONDS,
  FADE_CUTOFF_HIGH,
  FADE_CUTOFF_LOW,
  FADE_MIN_LENGTH_SECONDS,
  FADE_FRAME_SIZE,
  FADE_HOP_SIZE,
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
    const pairs = pairFades(fades, FADE_PAIR_MAX_GAP_SECONDS);

    const fadePath = writeFade(episodeNumber, { fades: pairs });
    const fades = await detectFades(pcmPath);

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
 * Run Essentia FadeDetection on a PCM file and return fade spans.
 */
export async function detectFades(pcmPath: string): Promise<FadeSpan[]> {
  const { stdout } = await execFileAsync(VENV_PYTHON, [
    FADE_SCRIPT,
    pcmPath,
    '--frame-size', String(FADE_FRAME_SIZE),
    '--hop-size', String(FADE_HOP_SIZE),
    '--cutoff-high', String(FADE_CUTOFF_HIGH),
    '--cutoff-low', String(FADE_CUTOFF_LOW),
    '--min-length', String(FADE_MIN_LENGTH_SECONDS),
  ]);
  return FadeSpansSchema.parse(JSON.parse(stdout));
}

// -----------------------------------------------------------------------------
// Pairing
// -----------------------------------------------------------------------------
/**
 * Keep only paired fade-outs and fade-ins within `maxGap` seconds. Negative
 * gaps (the fade-in begins before the fade-out ends) are always kept since they
 * represent crossfades. Unpaired fades are discarded.
 */
export function pairFades(fades: readonly FadeSpan[], maxGap: number): FadePair[] {
  const sorted = fades.toSorted((a, b) => a.start - b.start);
  const pairs: FadePair[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const out = sorted[i]!;
    if (out.type !== 'out') continue;
    const next = sorted[i + 1];
    if (!next || next.type !== 'in') continue;
    if (next.start - out.end > maxGap) continue;
    pairs.push({
      outStart: out.start,
      outEnd: out.end,
      inStart: next.start,
      inEnd: next.end,
    });
    i++;
  }
  return pairs;
}
