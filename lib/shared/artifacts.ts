import type { z } from 'zod';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OUTPUTS_DIR, TMP_DIR } from '@lib/shared/paths.js';
import {
  MetadataFileSchema,
  GapsFileSchema,
  FadeFileSchema,
  TranscriptFileSchema,
  ParagraphFileSchema,
} from '@lib/shared/schemas.js';
import { formatEpisodeNumber, toPrettyJson } from '@lib/shared/strings.js';

export type MetadataFile = z.infer<typeof MetadataFileSchema>;
export type GapsFile = z.infer<typeof GapsFileSchema>;
export type FadeFile = z.infer<typeof FadeFileSchema>;
export type TranscriptFile = z.infer<typeof TranscriptFileSchema>;
export type ParagraphFile = z.infer<typeof ParagraphFileSchema>;

const SUFFIX = {
  metadata: '.metadata.json',
  gaps: '.audio-gaps.json',
  fade: '.audio-fade.json',
  transcript: '.transcript.json',
  paragraph: '.transcript.paragraph.json',
  markdown: '.transcript.md',
} as const;

function pathFor(episodeNumber: number, suffix: string): string {
  return join(OUTPUTS_DIR, `${formatEpisodeNumber(episodeNumber)}${suffix}`);
}

function mp3PathFor(episodeNumber: number): string {
  return join(TMP_DIR, `${formatEpisodeNumber(episodeNumber)}.mp3`);
}

export function paths(episodeNumber: number): {
  metadata: string;
  mp3: string;
  gaps: string;
  fade: string;
  transcript: string;
  paragraph: string;
  markdown: string;
} {
  return {
    metadata: pathFor(episodeNumber, SUFFIX.metadata),
    mp3: mp3PathFor(episodeNumber),
    gaps: pathFor(episodeNumber, SUFFIX.gaps),
    fade: pathFor(episodeNumber, SUFFIX.fade),
    transcript: pathFor(episodeNumber, SUFFIX.transcript),
    paragraph: pathFor(episodeNumber, SUFFIX.paragraph),
    markdown: pathFor(episodeNumber, SUFFIX.markdown),
  };
}

export const hasMetadata = (n: number): boolean => existsSync(pathFor(n, SUFFIX.metadata));
export const hasMp3 = (n: number): boolean => existsSync(mp3PathFor(n));
export const hasGaps = (n: number): boolean => existsSync(pathFor(n, SUFFIX.gaps));
export const hasFade = (n: number): boolean => existsSync(pathFor(n, SUFFIX.fade));
export const hasTranscript = (n: number): boolean => existsSync(pathFor(n, SUFFIX.transcript));
export const hasParagraph = (n: number): boolean => existsSync(pathFor(n, SUFFIX.paragraph));
export const hasMarkdown = (n: number): boolean => existsSync(pathFor(n, SUFFIX.markdown));

function readJson<S extends z.ZodType>(path: string, schema: S): z.infer<S> {
  return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

function writeJson<S extends z.ZodType>(path: string, schema: S, data: z.infer<S>): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, toPrettyJson(schema.parse(data)));
  return path;
}

export const readMetadata = (n: number): MetadataFile =>
  readJson(pathFor(n, SUFFIX.metadata), MetadataFileSchema);
export const readGaps = (n: number): GapsFile =>
  readJson(pathFor(n, SUFFIX.gaps), GapsFileSchema);
export const readFade = (n: number): FadeFile =>
  readJson(pathFor(n, SUFFIX.fade), FadeFileSchema);
export const readTranscript = (n: number): TranscriptFile =>
  readJson(pathFor(n, SUFFIX.transcript), TranscriptFileSchema);
export const readParagraph = (n: number): ParagraphFile =>
  readJson(pathFor(n, SUFFIX.paragraph), ParagraphFileSchema);

export const writeMetadata = (n: number, data: MetadataFile): string =>
  writeJson(pathFor(n, SUFFIX.metadata), MetadataFileSchema, data);
export const writeGaps = (n: number, data: GapsFile): string =>
  writeJson(pathFor(n, SUFFIX.gaps), GapsFileSchema, data);
export const writeFade = (n: number, data: FadeFile): string =>
  writeJson(pathFor(n, SUFFIX.fade), FadeFileSchema, data);
export const writeTranscript = (n: number, data: TranscriptFile): string =>
  writeJson(pathFor(n, SUFFIX.transcript), TranscriptFileSchema, data);
export const writeParagraph = (n: number, data: ParagraphFile): string =>
  writeJson(pathFor(n, SUFFIX.paragraph), ParagraphFileSchema, data);

export function writeMarkdown(n: number, data: string): string {
  const path = pathFor(n, SUFFIX.markdown);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  return path;
}

/**
 * Returns sorted episode numbers derived from `*.metadata.json` filenames in
 * the outputs directory.
 */
export function listEpisodeNumbers(): number[] {
  const numbers: number[] = [];
  for (const file of readdirSync(OUTPUTS_DIR)) {
    if (!file.endsWith(SUFFIX.metadata)) continue;
    const prefix = file.slice(0, -SUFFIX.metadata.length);
    const n = Number(prefix);
    if (Number.isInteger(n) && n > 0) numbers.push(n);
  }
  return numbers.toSorted((a, b) => a - b);
}
