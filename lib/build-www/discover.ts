import {
  listEpisodeNumbers, readMetadata,
  hasTranscript, hasParagraph, readParagraph,
  type MetadataFile, type ParagraphFile,
} from '@lib/shared/artifacts.js';

export interface EpisodeArtifacts {
  metadata: MetadataFile;
  paragraph: ParagraphFile;
  fadePairStarts: number[];
}

export type DiscoveryResult =
  | { ok: true; artifacts: EpisodeArtifacts }
  | { ok: false; episodeNumber: number; reason: string };

/**
 * Scan the outputs directory and return a result per metadata file. Episodes
 * missing a transcript or paragraph sidecar are returned as `{ ok: false }`
 * entries so the caller can report the skip with a reason. The paragraph
 * sidecar carries both segments and fade-pair starts; its presence signals a
 * complete pipeline run.
 */
export function discoverEpisodes(): DiscoveryResult[] {
  const results: DiscoveryResult[] = [];

  for (const episodeNumber of listEpisodeNumbers()) {
    const metadata = readMetadata(episodeNumber);

    if (!hasTranscript(episodeNumber)) {
      results.push({ ok: false, episodeNumber, reason: 'No transcript found' });
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

    results.push({
      ok: true,
      artifacts: {
        metadata,
        paragraph,
        fadePairStarts: paragraph.fadePairStarts,
      },
    });
  }

  return results;
}
