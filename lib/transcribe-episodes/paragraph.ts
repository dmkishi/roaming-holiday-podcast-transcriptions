import type { z } from 'zod';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { episodePaths } from '@lib/transcribe-episodes/paths.js';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import type { Transcript } from '@lib/transcribe-episodes/transcript.js';
import { TranscriptFileSchema, ParagraphFileSchema } from '@lib/shared/schemas.js';
import { toPrettyJson } from '@lib/shared/strings.js';

const PARAGRAPH_GAP_SECONDS = 1;

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

/**
 * Computes the indices at which paragraphs begin in the given segment array.
 *
 * A paragraph break is inserted between segment N and segment N+1 when both:
 *   1. The gap between them is at least `gapSeconds`
 *   2. `segments[N].text` ends with a period
 *
 * The returned array always begins with `0` (the first paragraph begins at
 * the first segment). A single-paragraph transcript returns `[0]`. Caller
 * must ensure `segments` is non-empty.
 */
export function buildParagraphBreaks(
  segments: Segment[],
  gapSeconds: number,
): number[] {
  const breaks: number[] = [0];
  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i]!;
    const next = segments[i + 1]!;
    const gap = next.start - current.end;
    const endsWithPeriod = current.text.trimEnd().endsWith('.');
    if (gap >= gapSeconds && endsWithPeriod) {
      breaks.push(i + 1);
    }
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
    const { paragraph: path } = episodePaths({
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

    const breaks = buildParagraphBreaks(segments, PARAGRAPH_GAP_SECONDS);
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
