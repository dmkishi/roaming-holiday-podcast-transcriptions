import type { z } from 'zod';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OUTPUTS_DIR, TMP_DIR } from '#lib/shared/paths.ts';
import {
  RssFileSchema,
  GapsFileSchema,
  FadeFileSchema,
  TranscriptFileSchema,
} from '#lib/shared/schemas.ts';
import { formatEpisodeNumber, toPrettyJson } from '#lib/shared/strings.ts';

export type RssFile = z.infer<typeof RssFileSchema>;
type GapsFile = z.infer<typeof GapsFileSchema>;
type FadeFile = z.infer<typeof FadeFileSchema>;
export type TranscriptFile = z.infer<typeof TranscriptFileSchema>;

const SUFFIX = {
  rss: '.rss.json',
  gaps: '.audio-gaps.json',
  fade: '.audio-fade.json',
  transcript: '.transcript.json',
} as const;

function pathFor(episodeNumber: number, suffix: string): string {
  return join(OUTPUTS_DIR, `${formatEpisodeNumber(episodeNumber)}${suffix}`);
}

function mp3PathFor(episodeNumber: number): string {
  return join(TMP_DIR, `${formatEpisodeNumber(episodeNumber)}.mp3`);
}

export function paths(episodeNumber: number): {
  rss: string;
  mp3: string;
  gaps: string;
  fade: string;
  transcript: string;
} {
  return {
    rss: pathFor(episodeNumber, SUFFIX.rss),
    mp3: mp3PathFor(episodeNumber),
    gaps: pathFor(episodeNumber, SUFFIX.gaps),
    fade: pathFor(episodeNumber, SUFFIX.fade),
    transcript: pathFor(episodeNumber, SUFFIX.transcript),
  };
}

export const hasRss = (n: number): boolean => existsSync(pathFor(n, SUFFIX.rss));
export const hasMp3 = (n: number): boolean => existsSync(mp3PathFor(n));
export const hasGaps = (n: number): boolean => existsSync(pathFor(n, SUFFIX.gaps));
export const hasFade = (n: number): boolean => existsSync(pathFor(n, SUFFIX.fade));
export const hasTranscript = (n: number): boolean => existsSync(pathFor(n, SUFFIX.transcript));

function readJson<S extends z.ZodType>(path: string, schema: S): z.infer<S> {
  return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

function writeJson<S extends z.ZodType>(path: string, schema: S, data: z.infer<S>): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, toPrettyJson(schema.parse(data)));
  return path;
}

export const readRss = (n: number): RssFile =>
  readJson(pathFor(n, SUFFIX.rss), RssFileSchema);
export const readGaps = (n: number): GapsFile =>
  readJson(pathFor(n, SUFFIX.gaps), GapsFileSchema);
export const readFade = (n: number): FadeFile =>
  readJson(pathFor(n, SUFFIX.fade), FadeFileSchema);
export const readTranscript = (n: number): TranscriptFile =>
  readJson(pathFor(n, SUFFIX.transcript), TranscriptFileSchema);

export const writeRss = (n: number, data: RssFile): string =>
  writeJson(pathFor(n, SUFFIX.rss), RssFileSchema, data);
export const writeGaps = (n: number, data: GapsFile): string =>
  writeJson(pathFor(n, SUFFIX.gaps), GapsFileSchema, data);
export const writeFade = (n: number, data: FadeFile): string =>
  writeJson(pathFor(n, SUFFIX.fade), FadeFileSchema, data);
export const writeTranscript = (n: number, data: TranscriptFile): string =>
  writeJson(pathFor(n, SUFFIX.transcript), TranscriptFileSchema, data);

/**
 * Returns sorted episode numbers derived from `*.rss.json` filenames in the
 * outputs directory.
 */
export function listEpisodeNumbers(): number[] {
  if (!existsSync(OUTPUTS_DIR)) return [];

  const numbers: number[] = [];
  for (const file of readdirSync(OUTPUTS_DIR)) {
    if (!file.endsWith(SUFFIX.rss)) continue;
    const prefix = file.slice(0, -SUFFIX.rss.length);
    const n = Number(prefix);
    if (Number.isInteger(n) && n > 0) numbers.push(n);
  }
  return numbers.toSorted((a, b) => a - b);
}
