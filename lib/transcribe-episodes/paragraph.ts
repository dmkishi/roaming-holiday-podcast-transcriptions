import type { FailResponse } from '#lib/transcribe-episodes/types.ts';
import { hasGaps, readGaps, hasFade, readFade } from '#lib/shared/artifacts.ts';
import { errorMessage } from '#lib/shared/errors.ts';
import type {
  FadePair, Paragraph, ParagraphGroup, ParagraphSegment,
} from '#lib/shared/schemas.ts';
import { PARAGRAPH_GAP_SECONDS } from '#lib/config/audio.ts';

interface Paragraphs {
  ok: true;
  episodeNumber: number;
  paragraphGroups: ParagraphGroup[];
  stats: {
    paragraphs: number;
    paragraphGroups: number;
    fades: number;
  };
}

type ParagraphsResponse = FailResponse | Paragraphs;

/**
 * Computes paragraph breaks from a transcript's segments.
 */
export function buildParagraphs(
  episodeNumber: number,
  segments: ParagraphSegment[],
): ParagraphsResponse {
  try {
    if (segments.length === 0) {
      return {
        ok: false,
        error: 'No segments in transcript',
      };
    }

    if (!hasGaps(episodeNumber)) {
      return {
        ok: false,
        error: `Gaps file not found for #${episodeNumber}`,
      };
    }

    if (!hasFade(episodeNumber)) {
      return {
        ok: false,
        error: `Fade file not found for #${episodeNumber}`,
      };
    }

    const paragraphGroups: ParagraphGroup[] = [];
    const gapsFile = readGaps(episodeNumber);
    const { fades } = readFade(episodeNumber);
    const groupStartSegments = [0, ...findSegmentFadeBoundaries(segments, fades)];
    for (const [i, groupStart] of groupStartSegments.entries()) {
      const group = segments.slice(groupStart, groupStartSegments[i + 1] ?? segments.length);
      const breaks = buildParagraphBreaks(group, gapsFile.gaps, PARAGRAPH_GAP_SECONDS);
      const paragraphs: Paragraph[] = breaks.map((start, k) => {
        const end = breaks[k + 1] ?? group.length;
        return group.slice(start, end).map(
          (s) => ({ start: s.start, end: s.end, text: s.text, words: s.words }),
        );
      });
      paragraphGroups.push(paragraphs);
    }

    return {
      ok: true,
      episodeNumber,
      paragraphGroups,
      stats: {
        paragraphs: paragraphGroups.reduce((sum, group) => sum + group.length, 0),
        paragraphGroups: paragraphGroups.length,
        fades: fades.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
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
 * Computes paragraph break indices using detected audio gaps.
 *
 * For each gap greater than `paragraphGapSeconds`, a binary search locates the
 * Whisper segment that precedes the gap midpoint. A break is inserted after
 * that segment when it ends with sentence-ending punctuation (`.`, `?`, `!`).
 *
 * The returned array always begins with `0`. Caller must ensure `segments`
 * is non-empty.
 */
function buildParagraphBreaks(
  segments: ParagraphSegment[],
  gaps: readonly { start: number; end: number; duration: number }[],
  paragraphGapSeconds: number,
): number[] {
  const breaks: number[] = [0];
  for (const gap of gaps) {
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
function findSegmentBeforeTime(segments: ParagraphSegment[], time: number): number {
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
