import {
  listEpisodeNumbers, readRss, hasTranscript, readTranscript,
  type RssFile, type TranscriptFile,
} from '#lib/shared/artifacts.ts';

export interface EpisodeArtifacts {
  rss: RssFile;
  transcript: TranscriptFile;
}

type DiscoveryResult =
  | { ok: true; artifacts: EpisodeArtifacts }
  | { ok: false; episodeNumber: number; reason: string };

/**
 * Scan the outputs directory and return a result per RSS file. Episodes missing
 * a transcript are returned as `{ ok: false }` entries so the caller can report
 * the skip with a reason. The transcript carries the grouped paragraphs; its
 * presence signals a complete pipeline run.
 */
function discoverEpisodes(): DiscoveryResult[] {
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

let cache: EpisodeArtifacts[] | undefined;

/**
 * The successfully discovered artifacts, memoized for a single Eleventy build.
 * `_data/episodes.js` (via `buildEpisodes`), `_data/stats.js`, and the
 * cover-image `eleventy.before` hook all need the discovered episodes; without
 * the memo that's three full transcript reads per build.
 *
 * Incomplete episodes (missing or empty transcript) are skipped silently. The
 * cache MUST be reset on `eleventy.before` (see `resetDiscoveryCache`) so a
 * long-lived `--serve` process re-reads sources after an edit instead of
 * serving a stale cache.
 */
export function discoverArtifactsOnce(): EpisodeArtifacts[] {
  return (cache ??= discoverEpisodes().flatMap((r) => (r.ok ? [r.artifacts] : [])));
}

/**
 * Clear the `discoverArtifactsOnce` memo so the next build re-discovers from
 * disk. Call from `eleventy.before`; a plain module cache would otherwise go
 * stale across watch rebuilds in a single `eleventy --serve` process.
 */
export function resetDiscoveryCache(): void {
  cache = undefined;
}
