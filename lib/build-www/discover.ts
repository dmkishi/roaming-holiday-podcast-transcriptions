import {
  listEpisodeNumbers, readRss, hasTranscript, readTranscript,
  type RssFile, type TranscriptFile,
} from '@lib/shared/artifacts.js';

export interface EpisodeArtifacts {
  rss: RssFile;
  transcript: TranscriptFile;
}

export type DiscoveryResult =
  | { ok: true; artifacts: EpisodeArtifacts }
  | { ok: false; episodeNumber: number; reason: string };

/**
 * Scan the outputs directory and return a result per RSS file. Episodes missing
 * a transcript are returned as `{ ok: false }` entries so the caller can report
 * the skip with a reason. The transcript carries the grouped paragraphs; its
 * presence signals a complete pipeline run.
 */
export function discoverEpisodes(): DiscoveryResult[] {
  const results: DiscoveryResult[] = [];

  for (const episodeNumber of listEpisodeNumbers()) {
    const rss = readRss(episodeNumber);

    if (!hasTranscript(episodeNumber)) {
      results.push({ ok: false, episodeNumber, reason: 'No transcript found' });
      continue;
    }
    const transcript = readTranscript(episodeNumber);
    if (transcript.paragraphGroups.length === 0) {
      results.push({ ok: false, episodeNumber, reason: 'No paragraph groups in transcript' });
      continue;
    }

    results.push({
      ok: true,
      artifacts: {
        rss,
        transcript,
      },
    });
  }

  return results;
}
