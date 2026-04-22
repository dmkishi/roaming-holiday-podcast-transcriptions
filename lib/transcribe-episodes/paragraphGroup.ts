import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import type { Paragraph } from '@lib/transcribe-episodes/paragraph.js';
import type { FadePair } from '@lib/shared/schemas.js';
import { hasFade, readFade } from '@lib/shared/artifacts.js';

export interface ParagraphGroups {
  ok: true;
  episodeNumber: number;
  fadePairStarts: number[];
  stats: {
    groups: number;
    fades: number;
  };
}

export type ParagraphGroupsResponse = FailResponse | ParagraphGroups;

/**
 * Reads the fade sidecar and computes the paragraph indices that begin under
 * each fade pair.
 */
export function buildParagraphGroups(
  { episodeNumber, paragraphs }: { episodeNumber: number; paragraphs: Paragraph[] },
): ParagraphGroupsResponse {
  try {
    if (!hasFade(episodeNumber)) {
      return { ok: false, error: `Fade file not found for #${episodeNumber}` };
    }

    const { fades } = readFade(episodeNumber);
    const fadePairStarts = findFadePairStarts(paragraphs, fades);

    return {
      ok: true,
      episodeNumber,
      fadePairStarts,
      stats: {
        groups: fadePairStarts.length + 1,
        fades: fades.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * For each fade pair, finds the first paragraph whose start lies within
 * `[outStart, inEnd]`, i.e. a paragraph that begins while audio plays over it
 * and records its index. Pairs with no overlapping paragraph start are
 * skipped.
 */
export function findFadePairStarts(
  paragraphs: Paragraph[],
  fadePairs: readonly FadePair[],
): number[] {
  const starts = paragraphs.map((p) => p[0]!.start);
  const fadePairStarts: number[] = [];
  for (const pair of fadePairs) {
    const i = starts.findIndex((s) => s >= pair.outStart && s <= pair.inEnd);
    if (i === -1) continue;
    if (fadePairStarts.at(-1) !== i) fadePairStarts.push(i);
  }
  return fadePairStarts;
}
