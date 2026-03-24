import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

export const TRANSCRIPTS_DIR = resolve(import.meta.dirname, '../transcripts');

export interface EpisodePathParams {
  episode: number;
  model: string;
  summaryModel?: string;
}

export interface EpisodePaths {
  rss: string;
  transcript: string;
  summary: string | null;
}

/**
 * Returns all artifact paths for a given episode/model combination.
 */
export function episodePaths(params: EpisodePathParams): EpisodePaths {
  const num = formatEpisodeNumber(params.episode);
  const model = handleize(params.model);
  return {
    rss: join(TRANSCRIPTS_DIR, `${num}.rss.json`),
    transcript: join(TRANSCRIPTS_DIR, `${num}.transcript__${model}.json`),
    summary: params.summaryModel
      ? join(TRANSCRIPTS_DIR, `${num}.transcript__${model}.summary__${handleize(params.summaryModel)}.json`)
      : null,
  };
}

export function findTranscript(episode: number, model: string): string | undefined {
  const num = formatEpisodeNumber(episode);
  const suffix = `.transcript__${handleize(model)}.json`;
  const files = readdirSync(TRANSCRIPTS_DIR);
  const match = files.find((f) =>
    f.startsWith(num) && f.includes(suffix) && !f.includes('.summary__'),
  );
  return match ? join(TRANSCRIPTS_DIR, match) : undefined;
}

function formatEpisodeNumber(n: number): string {
  return String(n).padStart(3, '0');
}

function handleize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
