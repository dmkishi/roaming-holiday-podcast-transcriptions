import { resolve, join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

export const TRANSCRIPTS_DIR = resolve(import.meta.dirname, '../transcripts');

export interface EpisodePathParams {
  episode: number;
  model: string;
  summaryModel?: string;
}

export interface EpisodePaths {
  meta: string;
  transcript: string;
  stats: string;
  summary: string | null;
}

/**
 * Returns all artifact paths for a given episode/model combination.
 */
export function episodePaths(params: EpisodePathParams): EpisodePaths {
  const num = formatEpisodeNumber(params.episode);
  const model = handelize(params.model);
  return {
    meta: join(TRANSCRIPTS_DIR, `${num}.episode-meta.json`),
    transcript: join(TRANSCRIPTS_DIR, `${num}.transcript__${model}.json`),
    stats: join(TRANSCRIPTS_DIR, `${num}.transcript__${model}.stats.json`),
    summary: params.summaryModel
      ? join(TRANSCRIPTS_DIR, `${num}.transcript__${model}.summary__${handelize(params.summaryModel)}.json`)
      : null,
  };
}

/**
 * Checks whether a transcript file already exists on disk.
 */
export function transcriptExists(params: { episode: number; model: string }): boolean {
  return existsSync(episodePaths(params).transcript);
}

/**
 * Scans the transcripts directory for a transcript file.
 */
export function findTranscript(episode: number, model?: string): string | undefined {
  const num = formatEpisodeNumber(episode);
  const suffix = model
    ? `.transcript__${handelize(model)}.json`
    : '.transcript__';
  const files = readdirSync(TRANSCRIPTS_DIR);
  const match = files.find((f) =>
    f.startsWith(num) && f.includes(suffix) && f.endsWith('.json') && !f.includes('.stats') && !f.includes('.summary__'),
  );
  return match ? join(TRANSCRIPTS_DIR, match) : undefined;
}

function formatEpisodeNumber(n: number): string {
  return String(n).padStart(3, '0');
}

function handelize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
