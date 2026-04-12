import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '@lib/shared/paths.js';
import { ParagraphFileSchema } from '@lib/shared/schemas.js';
// Summary path temporarily shelved — see plan.
// import { SummaryFileSchema } from '@lib/shared/schemas.js';
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
  paragraph: z.infer<typeof ParagraphFileSchema>;
  // summary: z.infer<typeof SummaryFileSchema>;
}

export type DiscoveryResult =
  | { ok: true; artifacts: EpisodeArtifacts }
  | { ok: false; episodeNumber: number; reason: string };

/**
 * Scan the outputs directory and return a result per metadata file. Episodes
 * missing a transcript or its paragraph sidecar are returned as
 * `{ ok: false }` entries so the caller can report the skip with a reason.
 * The paragraph sidecar is the authoritative source of segments downstream.
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
      && !f.includes('.summary__')
      && !f.includes('.paragraph'),
    );

    if (transcriptFile === undefined) {
      results.push({ ok: false, episodeNumber: ep, reason: 'No transcript found' });
      continue;
    }

    // Summary lookup temporarily shelved — see plan.
    // const summaryFile = files.find((f) =>
    //   f.startsWith(transcriptFile.replace('.json', '.summary__')),
    // );
    //
    // if (summaryFile === undefined) {
    //   results.push({ ok: false, episodeNumber: ep, reason: 'No summary found' });
    //   continue;
    // }

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

    // const summary = SummaryFileSchema.parse(
    //   JSON.parse(readFileSync(join(OUTPUTS_DIR, summaryFile), 'utf8')),
    // );

    results.push({
      ok: true,
      artifacts: {
        metadata,
        paragraph,
      },
    });
  }

  return results;
}
