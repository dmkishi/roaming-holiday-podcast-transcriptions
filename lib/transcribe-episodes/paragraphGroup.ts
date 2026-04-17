import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import type { TailItem } from '@lib/transcribe-episodes/transcript.js';
import {
  hasFade, hasVad, hasParagraph,
  readFade, readVad, readParagraph,
  writeParagraphGroup,
} from '@lib/shared/artifacts.js';
import { PARAGRAPH_GROUP_GAP_SECONDS } from '@lib/config/audio.js';

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
 * Reads the paragraph, VAD, and fade sidecars and writes `*.paragraphGroup.json`.
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
    if (!hasVad(episodeNumber)) {
      return { ok: false, error: `VAD file not found for #${episodeNumber}` };
    }
    if (!hasFade(episodeNumber)) {
      return { ok: false, error: `Fade file not found for #${episodeNumber}` };
    }

    const { segments: paragraphs } = readParagraph(episodeNumber);
    const { gaps } = readVad(episodeNumber);
    const { fades } = readFade(episodeNumber);

    const groupStarts = findGroupStarts(paragraphs, gaps, PARAGRAPH_GROUP_GAP_SECONDS);
    const path = writeParagraphGroup(episodeNumber, { groupStarts, fades });

    return {
      ok: true,
      episodeNumber,
      path,
      stats: {
        groups: groupStarts.length + 1,
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
interface VadGap { start: number; end: number; duration: number };

/**
 * For each VAD gap at least `threshold` long, finds the paragraph that
 * starts after it and records that paragraph's index as a group start.
 * Anchors on `gap.start` because Whisper can emit a next-paragraph start
 * timestamp slightly before VAD reports speech resumed.
 */
export function findGroupStarts(
  paragraphs: Paragraph[],
  gaps: readonly VadGap[],
  threshold: number,
): number[] {
  const starts = paragraphs.map((p) => p[0]!.start);
  const groupStarts: number[] = [];
  for (const gap of gaps) {
    if (gap.duration < threshold) continue;
    const i = starts.findIndex((s) => s > gap.start);
    if (i <= 0) continue;
    if (paragraphs[i - 1]!.at(-1)!.end > gap.start) continue;
    if (groupStarts.at(-1) !== i) groupStarts.push(i);
  }
  return groupStarts;
}
