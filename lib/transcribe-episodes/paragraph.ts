import type { z } from 'zod';
import { hasVad, readTranscript, readVad, writeParagraph } from '@lib/shared/artifacts.js';
import type { FailResponse, TailItem } from '@lib/transcribe-episodes/types.js';
import type { TranscriptFileSchema } from '@lib/shared/schemas.js';
import { PARAGRAPH_GAP_SECONDS } from '@lib/config/audio.js';

type Segment = NonNullable<z.infer<typeof TranscriptFileSchema>['segments']>[number];

export interface Paragraphs {
  ok: true;
  episodeNumber: number;
  path: string;
  stats: {
    paragraphs: number;
  };
}

export type ParagraphsResponse = FailResponse | Paragraphs;

/**
 * Reads a transcript file, computes paragraph breaks, and writes a sidecar
 * `.paragraph.json` file alongside it. Always overwrites.
 */
export function writeParagraphs(
  transcript: TailItem,
): ParagraphsResponse {
  try {
    const { segments } = readTranscript(transcript.episodeNumber);

    if (segments === undefined || segments.length === 0) {
      return {
        ok: false,
        error: 'No segments in transcript',
      };
    }

    if (!hasVad(transcript.episodeNumber)) {
      return {
        ok: false,
        error: `VAD file not found for #${transcript.episodeNumber}`,
      };
    }

    const vad = readVad(transcript.episodeNumber);
    const breaks = buildParagraphBreaks(segments, vad.gaps, PARAGRAPH_GAP_SECONDS);
    const simplifiedSegments = segments.map(({ start, end, text }) => ({ start, end, text }));
    const paragraphs = breaks.map((start, i) => {
      const end = breaks[i + 1] ?? simplifiedSegments.length;
      return simplifiedSegments.slice(start, end);
    });

    const path = writeParagraph(transcript.episodeNumber, { segments: paragraphs });

    return {
      ok: true,
      episodeNumber: transcript.episodeNumber,
      path,
      stats: {
        paragraphs: paragraphs.length,
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
