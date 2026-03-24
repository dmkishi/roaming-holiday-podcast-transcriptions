import { resolve, join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

export const TRANSCRIPTIONS_DIR = resolve(import.meta.dirname, '../transcriptions');

export interface EpisodePathParams {
  episode: number;
  model: string;
  summaryModel?: string;
}

export interface EpisodePaths {
  meta: string;
  transcription: string;
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
    meta: join(TRANSCRIPTIONS_DIR, `${num}.episode-meta.json`),
    transcription: join(TRANSCRIPTIONS_DIR, `${num}.transcript__${model}.json`),
    stats: join(TRANSCRIPTIONS_DIR, `${num}.transcript__${model}.stats.json`),
    summary: params.summaryModel
      ? join(TRANSCRIPTIONS_DIR, `${num}.transcript__${model}.summary__${handelize(params.summaryModel)}.json`)
      : null,
  };
}

/**
 * Checks whether a transcription file already exists on disk.
 */
export function transcriptionExists(params: { episode: number; model: string }): boolean {
  return existsSync(episodePaths(params).transcription);
}

/**
 * Scans the transcriptions directory for an existing transcription file
 * matching the episode number and optional model. Returns the full path or
 * undefined.
 */
export function findTranscription(episode: number, model?: string): string | undefined {
  const num = formatEpisodeNumber(episode);
  const suffix = model
    ? `.transcript__${handelize(model)}.json`
    : '.transcript__';
  const files = readdirSync(TRANSCRIPTIONS_DIR);
  const match = files.find((f) =>
    f.startsWith(num) && f.includes(suffix) && f.endsWith('.json') && !f.includes('.stats') && !f.includes('.summary__'),
  );
  return match ? join(TRANSCRIPTIONS_DIR, match) : undefined;
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
