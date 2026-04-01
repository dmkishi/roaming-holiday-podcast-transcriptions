import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { handleize } from '@lib/utils/strings.js';
import { OUTPUTS_DIR, ROOT } from '@lib/config/paths.js';

/**
 * Returns all artifact paths for a given episode/model combination.
 */
export function episodePaths(params: {
  episodeNumber: number;
  model: string;
  summaryModel?: string;
}): {
  metadata: string;
  transcript: string;
  summary: string | undefined;
} {
  const code = formatEpisodeNumber(params.episodeNumber);
  const model = handleize(params.model);
  return {
    metadata: join(OUTPUTS_DIR, `${code}.metadata.json`),
    transcript: join(OUTPUTS_DIR, `${code}.transcript__${model}.json`),
    summary: params.summaryModel === undefined
      ? undefined
      : join(OUTPUTS_DIR, `${code}.transcript__${model}.summary__${handleize(params.summaryModel)}.json`),
  };
}

/**
 * Searches the outputs directory for a transcript file matching the given
 * episode and model.
 */
export function findTranscript(
  episodeNumber: number,
  model: string,
): string | undefined {
  const code = formatEpisodeNumber(episodeNumber);
  const suffix = `.transcript__${handleize(model)}.json`;
  const files = readdirSync(OUTPUTS_DIR);
  const match = files.find((f) =>
    f.startsWith(code) && f.includes(suffix) && !f.includes('.summary__'),
  );
  return match ? join(OUTPUTS_DIR, match) : undefined;
}

export function toRelative(absolutePath: string): string {
  return relative(ROOT, absolutePath);
}

function formatEpisodeNumber(episodeNumber: number): string {
  return String(episodeNumber).padStart(3, '0');
}
