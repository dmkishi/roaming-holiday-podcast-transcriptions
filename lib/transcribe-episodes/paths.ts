import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '@lib/shared/paths.js';
import { formatEpisodeNumber, handleize } from '@lib/shared/strings.js';

/**
 * Returns all artifact paths for a given episode/model combination.
 */
export function episodePaths(params: {
  episodeNumber: number;
  model: string;
  summaryModel?: string;
}): {
  metadata: string;
  vad: string;
  transcript: string;
  paragraph: string;
  paragraphGroup: string;
  summary: string | undefined;
} {
  const code = formatEpisodeNumber(params.episodeNumber);
  const model = handleize(params.model);
  return {
    metadata: join(OUTPUTS_DIR, `${code}.metadata.json`),
    vad: join(OUTPUTS_DIR, `${code}.vad.json`),
    transcript: join(OUTPUTS_DIR, `${code}.transcript__${model}.json`),
    paragraph: join(OUTPUTS_DIR, `${code}.transcript__${model}.paragraph.json`),
    paragraphGroup: join(OUTPUTS_DIR, `${code}.transcript__${model}.paragraphGroup.json`),
    // Unlikely to have surprising falsy values.
    // oxlint-disable-next-line typescript/strict-boolean-expressions
    summary: params.summaryModel
      ? join(OUTPUTS_DIR, `${code}.transcript__${model}.summary__${handleize(params.summaryModel)}.txt`)
      : undefined,
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
  // Unlikely to have surprising falsy values.
  // oxlint-disable-next-line typescript/strict-boolean-expressions
  return match ? join(OUTPUTS_DIR, match) : undefined;
}

/**
 * Searches the outputs directory for all transcript files belonging to the
 * given episode, regardless of model.
 */
export function findTranscripts(
  episodeNumber: number,
): { path: string; model: string }[] {
  const code = formatEpisodeNumber(episodeNumber);
  const transcriptPattern = new RegExp(`^${code}\\.transcript__([^.]+)\\.json$`);

  const matches = readdirSync(OUTPUTS_DIR)
    .map((f) => transcriptPattern.exec(f))
    .filter((m) => m !== null);
  return matches.map((m) => ({
    path: join(OUTPUTS_DIR, m[0]),
    model: m[1]!,
  }));
}
