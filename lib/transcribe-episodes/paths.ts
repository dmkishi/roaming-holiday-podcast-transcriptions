import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '@lib/shared/paths.js';
import { formatEpisodeNumber } from '@lib/shared/strings.js';

/**
 * Returns all artifact paths for a given episode.
 */
export function episodePaths(params: {
  episodeNumber: number;
  includeSummary?: boolean;
}): {
  metadata: string;
  vad: string;
  transcript: string;
  paragraph: string;
  paragraphGroup: string;
  summary: string | undefined;
} {
  const code = formatEpisodeNumber(params.episodeNumber);
  return {
    metadata: join(OUTPUTS_DIR, `${code}.metadata.json`),
    vad: join(OUTPUTS_DIR, `${code}.vad.json`),
    transcript: join(OUTPUTS_DIR, `${code}.transcript.json`),
    paragraph: join(OUTPUTS_DIR, `${code}.transcript.paragraph.json`),
    paragraphGroup: join(OUTPUTS_DIR, `${code}.transcript.paragraphGroup.json`),
    summary: params.includeSummary === true
      ? join(OUTPUTS_DIR, `${code}.transcript.summary.txt`)
      : undefined,
  };
}

/**
 * Returns the transcript path for the given episode if it exists on disk.
 */
export function findTranscript(episodeNumber: number): string | undefined {
  const path = join(OUTPUTS_DIR, `${formatEpisodeNumber(episodeNumber)}.transcript.json`);
  return existsSync(path) ? path : undefined;
}
