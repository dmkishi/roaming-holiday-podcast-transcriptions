import {
  listEpisodeNumbers, readMetadata,
  hasTranscript, hasParagraph, readParagraph,
  type MetadataFile, type ParagraphFile,
} from '@lib/shared/artifacts.js';

export interface EpisodeArtifacts {
  metadata: MetadataFile;
  paragraph: ParagraphFile;
}

export type DiscoveryResult =
  | { ok: true; artifacts: EpisodeArtifacts }
  | { ok: false; episodeNumber: number; reason: string };

/**
 * Scan the outputs directory and return a result per metadata file. Episodes
 * missing a transcript or paragraph sidecar are returned as `{ ok: false }`
 * entries so the caller can report the skip with a reason. The paragraph
 * sidecar carries the grouped paragraphs; its presence signals a complete
 * pipeline run.
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
    if (paragraph.paragraphGroups.length === 0) {
      results.push({ ok: false, episodeNumber, reason: 'No paragraph groups in sidecar' });
      continue;
    }

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
