import {
  listEpisodeNumbers, readRss, hasParagraph, readParagraph,
  type RssFile, type ParagraphFile,
} from '@lib/shared/artifacts.js';

export interface EpisodeArtifacts {
  rss: RssFile;
  paragraph: ParagraphFile;
}

export type DiscoveryResult =
  | { ok: true; artifacts: EpisodeArtifacts }
  | { ok: false; episodeNumber: number; reason: string };

/**
 * Scan the outputs directory and return a result per RSS file. Episodes missing
 * a paragraph sidecar are returned as `{ ok: false }` entries so the caller can
 * report the skip with a reason. The paragraph sidecar carries the grouped
 * paragraphs; its presence signals a complete pipeline run.
 */
export function discoverEpisodes(): DiscoveryResult[] {
  const results: DiscoveryResult[] = [];

  for (const episodeNumber of listEpisodeNumbers()) {
    const rss = readRss(episodeNumber);

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
        rss,
        paragraph,
      },
    });
  }

  return results;
}
