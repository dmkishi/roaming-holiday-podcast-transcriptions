import type { z } from 'zod';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OUTPUTS_DIR, TMP_DIR } from '@lib/shared/paths.js';
import {
  MetadataFileSchema,
  VadFileSchema,
  FadeFileSchema,
  TranscriptFileSchema,
  ParagraphFileSchema,
  ParagraphGroupFileSchema,
} from '@lib/shared/schemas.js';
import { formatEpisodeNumber, toPrettyJson } from '@lib/shared/strings.js';

export type MetadataFile = z.infer<typeof MetadataFileSchema>;
export type VadFile = z.infer<typeof VadFileSchema>;
export type FadeFile = z.infer<typeof FadeFileSchema>;
export type TranscriptFile = z.infer<typeof TranscriptFileSchema>;
export type ParagraphFile = z.infer<typeof ParagraphFileSchema>;
export type ParagraphGroupFile = z.infer<typeof ParagraphGroupFileSchema>;

const SUFFIX = {
  metadata: '.metadata.json',
  vad: '.vad.json',
  fade: '.fade.json',
  transcript: '.transcript.json',
  paragraph: '.transcript.paragraph.json',
  paragraphGroup: '.transcript.paragraphGroup.json',
  summary: '.transcript.summary.txt',
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
  vad: string;
  fade: string;
  transcript: string;
  paragraph: string;
  paragraphGroup: string;
  summary: string;
} {
  return {
    metadata: pathFor(episodeNumber, SUFFIX.metadata),
    mp3: mp3PathFor(episodeNumber),
    vad: pathFor(episodeNumber, SUFFIX.vad),
    fade: pathFor(episodeNumber, SUFFIX.fade),
    transcript: pathFor(episodeNumber, SUFFIX.transcript),
    paragraph: pathFor(episodeNumber, SUFFIX.paragraph),
    paragraphGroup: pathFor(episodeNumber, SUFFIX.paragraphGroup),
    summary: pathFor(episodeNumber, SUFFIX.summary),
  };
}

export const hasMetadata = (n: number): boolean => existsSync(pathFor(n, SUFFIX.metadata));
export const hasMp3 = (n: number): boolean => existsSync(mp3PathFor(n));
export const hasVad = (n: number): boolean => existsSync(pathFor(n, SUFFIX.vad));
export const hasFade = (n: number): boolean => existsSync(pathFor(n, SUFFIX.fade));
export const hasTranscript = (n: number): boolean => existsSync(pathFor(n, SUFFIX.transcript));
export const hasParagraph = (n: number): boolean => existsSync(pathFor(n, SUFFIX.paragraph));
export const hasParagraphGroup = (n: number): boolean =>
  existsSync(pathFor(n, SUFFIX.paragraphGroup));
export const hasSummary = (n: number): boolean => existsSync(pathFor(n, SUFFIX.summary));

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
export const readVad = (n: number): VadFile =>
  readJson(pathFor(n, SUFFIX.vad), VadFileSchema);
export const readFade = (n: number): FadeFile =>
  readJson(pathFor(n, SUFFIX.fade), FadeFileSchema);
export const readTranscript = (n: number): TranscriptFile =>
  readJson(pathFor(n, SUFFIX.transcript), TranscriptFileSchema);
export const readParagraph = (n: number): ParagraphFile =>
  readJson(pathFor(n, SUFFIX.paragraph), ParagraphFileSchema);
export const readParagraphGroup = (n: number): ParagraphGroupFile =>
  readJson(pathFor(n, SUFFIX.paragraphGroup), ParagraphGroupFileSchema);
export const readSummary = (n: number): string =>
  readFileSync(pathFor(n, SUFFIX.summary), 'utf8');

export const writeMetadata = (n: number, data: MetadataFile): string =>
  writeJson(pathFor(n, SUFFIX.metadata), MetadataFileSchema, data);
export const writeVad = (n: number, data: VadFile): string =>
  writeJson(pathFor(n, SUFFIX.vad), VadFileSchema, data);
export const writeFade = (n: number, data: FadeFile): string =>
  writeJson(pathFor(n, SUFFIX.fade), FadeFileSchema, data);
export const writeTranscript = (n: number, data: TranscriptFile): string =>
  writeJson(pathFor(n, SUFFIX.transcript), TranscriptFileSchema, data);
export const writeParagraph = (n: number, data: ParagraphFile): string =>
  writeJson(pathFor(n, SUFFIX.paragraph), ParagraphFileSchema, data);
export const writeParagraphGroup = (n: number, data: ParagraphGroupFile): string =>
  writeJson(pathFor(n, SUFFIX.paragraphGroup), ParagraphGroupFileSchema, data);

export function writeSummary(n: number, text: string): string {
  const path = pathFor(n, SUFFIX.summary);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
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
