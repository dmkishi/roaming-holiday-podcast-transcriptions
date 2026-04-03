import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '@lib/config/paths.js';
import { TranscriptFileSchema, SummaryFileSchema } from '@lib/shared/schemas.js';
import type { z } from 'zod';

interface MetadataFile {
  episodeNumber: number;
  title: string;
  description: string;
  pubDate: string;
  duration: { seconds: number; timestamp: string; human: string };
  imageUrl: string;
  mp3Url: string;
}

export interface EpisodeArtifacts {
  metadata: MetadataFile;
  transcript: z.infer<typeof TranscriptFileSchema> & { segments: NonNullable<z.infer<typeof TranscriptFileSchema>['segments']> };
  summary: z.infer<typeof SummaryFileSchema>;
}

/**
 * Scan the outputs directory and return parsed artifacts for each episode that
 * has a complete set of metadata, transcript (with segments), and summary.
 */
export function discoverEpisodes(): EpisodeArtifacts[] {
  const files = readdirSync(OUTPUTS_DIR);
  const metadataFiles = files.filter((f) => f.endsWith('.metadata.json'));
  const results: EpisodeArtifacts[] = [];

  for (const metaFile of metadataFiles) {
    // oxlint-disable-next-line typescript/no-unsafe-assignment
    const metadata: MetadataFile = JSON.parse(
      readFileSync(join(OUTPUTS_DIR, metaFile), 'utf8'),
    );
    const ep = metadata.episodeNumber;
    const prefix = metaFile.replace('.metadata.json', '');

    const transcriptFile = files.find((f) =>
      f.startsWith(`${prefix}.transcript__`)
      && !f.includes('.summary__'),
    );

    if (transcriptFile === undefined) {
      console.warn(`[discover] No transcript found for episode ${ep}, skipping`);
      continue;
    }

    const summaryFile = files.find((f) =>
      f.startsWith(transcriptFile.replace('.json', '.summary__')),
    );

    if (summaryFile === undefined) {
      console.warn(`[discover] No summary found for episode ${ep}, skipping`);
      continue;
    }

    const transcript = TranscriptFileSchema.parse(
      JSON.parse(readFileSync(join(OUTPUTS_DIR, transcriptFile), 'utf8')),
    );

    if (transcript.segments === undefined || transcript.segments.length === 0) {
      console.warn(`[discover] No segments in transcript for episode ${ep}, skipping`);
      continue;
    }

    const summary = SummaryFileSchema.parse(
      JSON.parse(readFileSync(join(OUTPUTS_DIR, summaryFile), 'utf8')),
    );

    results.push({
      metadata,
      transcript: { ...transcript, segments: transcript.segments },
      summary,
    });
  }

  return results;
}
