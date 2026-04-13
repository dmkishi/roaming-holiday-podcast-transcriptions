import type { z } from 'zod';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { episodePaths } from '@lib/transcribe-episodes/paths.js';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import type { Transcript } from '@lib/transcribe-episodes/transcript.js';
import { TranscriptFileSchema, ParagraphFileSchema, VadFileSchema } from '@lib/shared/schemas.js';
import { toPrettyJson } from '@lib/shared/strings.js';
import { PARAGRAPH_GAP_SECONDS } from '@lib/config/vad.js';

type Segment = NonNullable<z.infer<typeof TranscriptFileSchema>['segments']>[number];

export type ParagraphInput = Pick<Transcript, 'episodeNumber' | 'path'>;

export type Paragraphs =
  | {
      ok: true;
      status: 'generated';
      episodeNumber: number;
      path: string;
      stats: {
        paragraphs: number;
        segments: number;
      };
    }
  | {
      ok: true;
      status: 'alreadyExists';
      episodeNumber: number;
      path: string;
    };

export type ParagraphsResponse = FailResponse | Paragraphs;

function endsSentence(text: string): boolean {
  const trimmed = text.trimEnd();
  return trimmed.endsWith('.') || trimmed.endsWith('?') || trimmed.endsWith('!');
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
 * Builds one joined text string per paragraph. Each element concatenates the
 * constituent segments' texts, trimmed and joined with a single space.
 * Output length matches `breaks.length`.
 */
export function buildParagraphTexts(
  segments: readonly { text: string }[],
  breaks: readonly number[],
): string[] {
  return breaks.map((start, i) => {
    const end = breaks[i + 1] ?? segments.length;
    return segments.slice(start, end).map((s) => s.text.trim()).join(' ');
  });
}

/**
 * Reads a transcript file, computes paragraph breaks, and writes a sidecar
 * `.paragraph.json` file alongside it. Skips when the sidecar already exists
 * unless `force` is true.
 */
export function writeParagraphs(
  transcript: ParagraphInput,
  transcriptModel: string,
  force: boolean,
): ParagraphsResponse {
  try {
    const { paragraph: path, vad: vadPath } = episodePaths({
      episodeNumber: transcript.episodeNumber,
      model: transcriptModel,
    });

    if (!force && existsSync(path)) {
      return {
        ok: true,
        status: 'alreadyExists',
        episodeNumber: transcript.episodeNumber,
        path,
      };
    }

    const { segments } = TranscriptFileSchema.parse(
      JSON.parse(readFileSync(transcript.path, 'utf8')),
    );

    if (segments === undefined || segments.length === 0) {
      return {
        ok: false,
        error: 'No segments in transcript',
      };
    }

    if (!existsSync(vadPath)) {
      return {
        ok: false,
        error: `VAD file not found: ${vadPath}`,
      };
    }

    const vad = VadFileSchema.parse(JSON.parse(readFileSync(vadPath, 'utf8')));
    const breaks = buildParagraphBreaks(segments, vad.gaps, PARAGRAPH_GAP_SECONDS);
    const simplifiedSegments = segments.map(({ start, end, text }) => ({ start, end, text }));
    const text = buildParagraphTexts(simplifiedSegments, breaks);
    const payload = ParagraphFileSchema.parse({ text, breaks, segments: simplifiedSegments });

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, toPrettyJson(payload));

    return {
      ok: true,
      status: 'generated',
      episodeNumber: transcript.episodeNumber,
      path,
      stats: {
        paragraphs: breaks.length,
        segments: segments.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
