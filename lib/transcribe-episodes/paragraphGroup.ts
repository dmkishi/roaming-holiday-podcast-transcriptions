import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { episodePaths } from '@lib/transcribe-episodes/paths.js';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import type { Transcript } from '@lib/transcribe-episodes/transcript.js';
import {
  ParagraphFileSchema,
  ParagraphGroupFileSchema,
  VadFileSchema,
} from '@lib/shared/schemas.js';
import { toPrettyJson } from '@lib/shared/strings.js';
import { PARAGRAPH_GROUP_GAP_SECONDS } from '@lib/config/audio.js';

export type ParagraphGroupInput = Pick<Transcript, 'episodeNumber'>;

export interface ParagraphGroups {
  ok: true;
  episodeNumber: number;
  path: string;
  stats: {
    groups: number;
  };
}

export type ParagraphGroupsResponse = FailResponse | ParagraphGroups;

/**
 * Reads the paragraph and VAD sidecars and writes `*.paragraphGroup.json` which
 * lists paragraph indices where a new paragraph group starts according to the
 * intervening VAD silence is at least PARAGRAPH_GROUP_GAP_SECONDS. Always
 * overwrites.
 */
export function writeParagraphGroups(
  transcript: ParagraphGroupInput,
): ParagraphGroupsResponse {
  try {
    const { paragraph: paragraphPath, paragraphGroup: path, vad: vadPath } =
      episodePaths(transcript.episodeNumber);

    if (!existsSync(paragraphPath)) {
      return { ok: false, error: `Paragraph file not found: ${paragraphPath}` };
    }
    if (!existsSync(vadPath)) {
      return { ok: false, error: `VAD file not found: ${vadPath}` };
    }

    const { segments: paragraphs } = ParagraphFileSchema.parse(
      JSON.parse(readFileSync(paragraphPath, 'utf8')),
    );
    const { gaps } = VadFileSchema.parse(
      JSON.parse(readFileSync(vadPath, 'utf8')),
    );

    const groupStarts = findGroupStarts(paragraphs, gaps, PARAGRAPH_GROUP_GAP_SECONDS);
    const payload = ParagraphGroupFileSchema.parse({ groupStarts });

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, toPrettyJson(payload));

    return {
      ok: true,
      episodeNumber: transcript.episodeNumber,
      path,
      stats: {
        groups: groupStarts.length + 1,
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
