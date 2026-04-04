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

export type DiscoveryResult =
  | { ok: true; artifacts: EpisodeArtifacts }
  | { ok: false; episodeNumber: number; reason: string };

/**
 * Scan the outputs directory and return a result per metadata file. Episodes
 * missing a transcript, summary, or segments are returned as `{ ok: false }`
 * entries so the caller can report the skip with a reason.
 */
export function discoverEpisodes(): DiscoveryResult[] {
  const files = readdirSync(OUTPUTS_DIR);
  const metadataFiles = files.filter((f) => f.endsWith('.metadata.json'));
  const results: DiscoveryResult[] = [];

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
      results.push({ ok: false, episodeNumber: ep, reason: 'No transcript found' });
      continue;
    }

    const summaryFile = files.find((f) =>
      f.startsWith(transcriptFile.replace('.json', '.summary__')),
    );

    if (summaryFile === undefined) {
      results.push({ ok: false, episodeNumber: ep, reason: 'No summary found' });
      continue;
    }

    const transcript = TranscriptFileSchema.parse(
      JSON.parse(readFileSync(join(OUTPUTS_DIR, transcriptFile), 'utf8')),
    );

    if (transcript.segments === undefined || transcript.segments.length === 0) {
      results.push({ ok: false, episodeNumber: ep, reason: 'No segments in transcript' });
      continue;
    }

    const summary = SummaryFileSchema.parse(
      JSON.parse(readFileSync(join(OUTPUTS_DIR, summaryFile), 'utf8')),
    );

    results.push({
      ok: true,
      artifacts: {
        metadata,
        transcript: { ...transcript, segments: transcript.segments },
        summary,
      },
    });
  }

  return results;
}
