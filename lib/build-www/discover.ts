import type { z } from 'zod';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '@lib/shared/paths.js';
import { ParagraphFileSchema, ParagraphGroupFileSchema } from '@lib/shared/schemas.js';
import type { EpisodeFile } from '@lib/transcribe-episodes/episode.js';

export interface EpisodeArtifacts {
  metadata: EpisodeFile;
  paragraph: z.infer<typeof ParagraphFileSchema>;
  groupStarts: number[];
  summary: string;
}

export type DiscoveryResult =
  | { ok: true; artifacts: EpisodeArtifacts }
  | { ok: false; episodeNumber: number; reason: string };

/**
 * Scan the outputs directory and return a result per metadata file. Episodes
 * missing a transcript, paragraph sidecar, or paragraph group sidecar are
 * returned as `{ ok: false }` entries so the caller can report the skip with
 * a reason. The paragraph sidecar is the authoritative source of segments
 * downstream.
 */
export function discoverEpisodes(): DiscoveryResult[] {
  const files = readdirSync(OUTPUTS_DIR);
  const metadataFiles = files.filter((f) => f.endsWith('.metadata.json'));
  const results: DiscoveryResult[] = [];

  for (const metaFile of metadataFiles) {
    // oxlint-disable-next-line typescript/no-unsafe-assignment
    const metadata: EpisodeFile = JSON.parse(
      readFileSync(join(OUTPUTS_DIR, metaFile), 'utf8'),
    );
    const ep = metadata.episodeNumber;
    const prefix = metaFile.replace('.metadata.json', '');

    const transcriptFile = files.find((f) =>
      f.startsWith(`${prefix}.transcript__`)
      && !f.includes('.summary__')
      && !f.includes('.paragraph'),
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

    const paragraphFileName = transcriptFile.replace('.json', '.paragraph.json');
    if (!files.includes(paragraphFileName)) {
      results.push({ ok: false, episodeNumber: ep, reason: 'No paragraph sidecar found' });
      continue;
    }

    const paragraph = ParagraphFileSchema.parse(
      JSON.parse(readFileSync(join(OUTPUTS_DIR, paragraphFileName), 'utf8')),
    );

    if (paragraph.segments.length === 0) {
      results.push({ ok: false, episodeNumber: ep, reason: 'No segments in paragraph sidecar' });
      continue;
    }

    const paragraphGroupFileName = transcriptFile.replace('.json', '.paragraphGroup.json');
    if (!files.includes(paragraphGroupFileName)) {
      results.push({ ok: false, episodeNumber: ep, reason: 'No paragraph group sidecar found' });
      continue;
    }

    const { groupStarts } = ParagraphGroupFileSchema.parse(
      JSON.parse(readFileSync(join(OUTPUTS_DIR, paragraphGroupFileName), 'utf8')),
    );

    results.push({
      ok: true,
      artifacts: {
        metadata,
        paragraph,
        groupStarts,
        summary: readFileSync(join(OUTPUTS_DIR, summaryFile), 'utf8'),
      },
    });
  }

  return results;
}
