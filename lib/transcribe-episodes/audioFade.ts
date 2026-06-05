import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FailResponse } from '#lib/transcribe-episodes/types.js';
import { decodePcm } from '#lib/transcribe-episodes/audioPcm.js';
import { writeFade } from '#lib/shared/artifacts.js';
import { VENV_PYTHON, FADE_SCRIPT } from '#lib/shared/paths.js';
import { FadesSchema, type Fade, type FadePair } from '#lib/shared/schemas.js';
import {
  FADE_FRAME_SIZE, FADE_HOP_SIZE,
  FADE_CUTOFF_HIGH, FADE_CUTOFF_LOW,
  FADE_MIN_LENGTH_SECONDS, FADE_PAIR_MAX_GAP_SECONDS,
} from '#lib/config/audio.js';

type FadeResponse =
  | FailResponse
  | { ok: true; path: string };

// eslint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);

/**
 * Detect fade pairs and write to `<code>.audio-fade.json`.
 */
export async function runFade(
  episodeNumber: number,
  mp3Path: string,
): Promise<FadeResponse> {
  try {
    const pcmPath = await decodePcm(mp3Path);
    const fades = await detectFades(pcmPath);
    const fadePairs = pairFades(fades, FADE_PAIR_MAX_GAP_SECONDS);
    const fadePath = writeFade(episodeNumber, { fades: fadePairs });

    return {
      ok: true,
      path: fadePath,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function detectFades(pcmPath: string): Promise<Fade[]> {
  const { stdout } = await execFileAsync(VENV_PYTHON, [
    FADE_SCRIPT,
    pcmPath,
    '--frame-size', String(FADE_FRAME_SIZE),
    '--hop-size', String(FADE_HOP_SIZE),
    '--cutoff-high', String(FADE_CUTOFF_HIGH),
    '--cutoff-low', String(FADE_CUTOFF_LOW),
    '--min-length', String(FADE_MIN_LENGTH_SECONDS),
  ]);
  return FadesSchema.parse(JSON.parse(stdout));
}

/**
 * Pair two fades (fade-out and fade-in) within `maxGap` seconds. Unpaired fades
 * are discarded.
 */
function pairFades(fades: readonly Fade[], maxGap: number): FadePair[] {
  const sorted = fades.toSorted((a, b) => a.start - b.start);
  const fadePairs: FadePair[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const out = sorted[i]!;
    if (out.type !== 'out') continue;
    const next = sorted[i + 1];
    if (!next || next.type !== 'in') continue;
    if (next.start - out.end > maxGap) continue;
    fadePairs.push({
      outStart: out.start,
      outEnd: out.end,
      inStart: next.start,
      inEnd: next.end,
    });
    i++;
  }
  return fadePairs;
}
