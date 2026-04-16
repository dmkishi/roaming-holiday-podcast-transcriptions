import {
  hasParagraph, hasParagraphGroup, hasSummary, hasTranscript,
  listEpisodeNumbers, readMetadata, readParagraph, readParagraphGroup, readSummary,
  type MetadataFile, type ParagraphFile,
} from '@lib/shared/artifacts.js';

export interface EpisodeArtifacts {
  metadata: MetadataFile;
  paragraph: ParagraphFile;
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
  const results: DiscoveryResult[] = [];

  for (const episodeNumber of listEpisodeNumbers()) {
    const metadata = readMetadata(episodeNumber);

    if (!hasTranscript(episodeNumber)) {
      results.push({ ok: false, episodeNumber, reason: 'No transcript found' });
      continue;
    }
    if (!hasSummary(episodeNumber)) {
      results.push({ ok: false, episodeNumber, reason: 'No summary found' });
      continue;
    }
    if (!hasParagraph(episodeNumber)) {
      results.push({ ok: false, episodeNumber, reason: 'No paragraph sidecar found' });
      continue;
    }
    const paragraph = readParagraph(episodeNumber);
    if (paragraph.segments.length === 0) {
      results.push({ ok: false, episodeNumber, reason: 'No segments in paragraph sidecar' });
      continue;
    }
    if (!hasParagraphGroup(episodeNumber)) {
      results.push({ ok: false, episodeNumber, reason: 'No paragraph group sidecar found' });
      continue;
    }

    const { groupStarts } = readParagraphGroup(episodeNumber);

    results.push({
      ok: true,
      artifacts: {
        metadata,
        paragraph,
        groupStarts,
        summary: readSummary(episodeNumber),
      },
    });
  }

  return results;
}
