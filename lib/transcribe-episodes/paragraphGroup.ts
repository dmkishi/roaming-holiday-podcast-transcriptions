import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import type { TailItem } from '@lib/transcribe-episodes/transcript.js';
import type { FadePair } from '@lib/shared/schemas.js';
import {
  hasFade, hasParagraph,
  readFade, readParagraph,
  writeParagraphGroup,
} from '@lib/shared/artifacts.js';

export interface ParagraphGroups {
  ok: true;
  episodeNumber: number;
  path: string;
  stats: {
    groups: number;
    fades: number;
  };
}

export type ParagraphGroupsResponse = FailResponse | ParagraphGroups;

/**
 * Reads the paragraph and fade sidecars and writes `*.paragraphGroup.json`.
 * Always overwrites.
 */
export function writeParagraphGroups(
  transcript: TailItem,
): ParagraphGroupsResponse {
  try {
    const episodeNumber = transcript.episodeNumber;

    if (!hasParagraph(episodeNumber)) {
      return { ok: false, error: `Paragraph file not found for #${episodeNumber}` };
    }
    if (!hasFade(episodeNumber)) {
      return { ok: false, error: `Fade file not found for #${episodeNumber}` };
    }

    const { segments: paragraphs } = readParagraph(episodeNumber);
    const { fades } = readFade(episodeNumber);
    const fadePairStarts = findFadePairStarts(paragraphs, fades);
    const path = writeParagraphGroup(episodeNumber, { fadePairStarts });

    return {
      ok: true,
      episodeNumber,
      path,
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

type Paragraph = { start: number; end: number; text: string }[];

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
