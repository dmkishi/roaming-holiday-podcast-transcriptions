import type { z } from 'zod';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import {
  hasVad, readVad, hasFade, readFade, readTranscript, type ParagraphFile,
} from '@lib/shared/artifacts.js';
import type { FadePair, TranscriptFileSchema } from '@lib/shared/schemas.js';
import { PARAGRAPH_GAP_SECONDS } from '@lib/config/audio.js';

type Segment = NonNullable<z.infer<typeof TranscriptFileSchema>['segments']>[number];
export type Paragraph = ParagraphFile['segments'][number];

export interface Paragraphs {
  ok: true;
  episodeNumber: number;
  paragraphs: Paragraph[];
  fadePairStarts: number[];
  stats: {
    paragraphs: number;
    paragraphGroups: number;
    fades: number;
  };
}

export type ParagraphsResponse = FailResponse | Paragraphs;

/**
 * Reads a transcript file and computes paragraph breaks.
 */
export function buildParagraphs(
  episodeNumber: number,
): ParagraphsResponse {
  try {
    const { segments } = readTranscript(episodeNumber);

    if (segments === undefined || segments.length === 0) {
      return {
        ok: false,
        error: 'No segments in transcript',
      };
    }

    if (!hasVad(episodeNumber)) {
      return {
        ok: false,
        error: `VAD file not found for #${episodeNumber}`,
      };
    }

    if (!hasFade(episodeNumber)) {
      return {
        ok: false,
        error: `Fade file not found for #${episodeNumber}`,
      };
    }

    const vad = readVad(episodeNumber);
    const { fades } = readFade(episodeNumber);

    // Split segments into groups at each fade (interlude), then break each
    // group into paragraphs on its VAD gaps. The first paragraph of every
    // group after the first begins a new fade pair.
    const groupStartSegments = [0, ...findSegmentFadeBoundaries(segments, fades)];

    const paragraphs: Paragraph[] = [];
    const groupStartParagraphs: number[] = [];
    for (const [i, groupStart] of groupStartSegments.entries()) {
      if (i > 0) groupStartParagraphs.push(paragraphs.length);
      const group = segments.slice(groupStart, groupStartSegments[i + 1] ?? segments.length);
      const breaks = buildParagraphBreaks(group, vad.gaps, PARAGRAPH_GAP_SECONDS);
      for (const [k, start] of breaks.entries()) {
        const end = breaks[k + 1] ?? group.length;
        paragraphs.push(group.slice(start, end).map(
          (s) => ({ start: s.start, end: s.end, text: s.text, words: s.words }),
        ));
      }
    }

    return {
      ok: true,
      episodeNumber,
      paragraphs,
      fadePairStarts: groupStartParagraphs,
      stats: {
        paragraphs: paragraphs.length,
        paragraphGroups: groupStartParagraphs.length + 1,
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
 * Find segment indices that coincide with audio fades, i.e. segments whose
 * `start` is at or after the audio fade-in end time, i.e. where speech resumes
 * once the audio has fully faded.
 */
export function findSegmentFadeBoundaries(
  segments: readonly { start: number }[],
  fadePairs: readonly FadePair[],
): number[] {
  const boundaries: number[] = [];
  for (const fadePair of fadePairs) {
    const index = segments.findIndex((segment) => segment.start >= fadePair.outStart);
    if (index <= 0) continue;
    if (boundaries.at(-1) !== index) boundaries.push(index);
  }
  return boundaries;
}

/**
 * Computes paragraph break indices using VAD-detected speech gaps.
 *
 * For each VAD gap above `paragraphGapSeconds`, a binary search locates the
 * Whisper segment that precedes the gap midpoint. A break is inserted after
 * that segment when it ends with sentence-ending punctuation (`.`, `?`, `!`).
 *
 * The returned array always begins with `0`. Caller must ensure `segments`
 * is non-empty.
 */
export function buildParagraphBreaks(
  segments: Segment[],
  vadGaps: readonly { start: number; end: number; duration: number }[],
  paragraphGapSeconds: number,
): number[] {
  const breaks: number[] = [0];
  for (const gap of vadGaps) {
    if (gap.duration < paragraphGapSeconds) continue;
    const midpoint = (gap.start + gap.end) / 2;
    const segIndex = findSegmentBeforeTime(segments, midpoint);
    if (segIndex < 0 || segIndex >= segments.length - 1) continue;
    const breakIndex = segIndex + 1;
    if (!endsSentence(segments[segIndex]!.text)) continue;
    if (breaks.at(-1) === breakIndex) continue;
    breaks.push(breakIndex);
  }
  return breaks;
}

/**
 * Returns the index of the last segment whose `end` time is at or before
 * `time`, using binary search. Returns -1 when no segment qualifies.
 */
function findSegmentBeforeTime(segments: Segment[], time: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (segments[mid]!.end <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

function endsSentence(text: string): boolean {
  const trimmed = text.trimEnd();
  return trimmed.endsWith('.') || trimmed.endsWith('?') || trimmed.endsWith('!');
}
