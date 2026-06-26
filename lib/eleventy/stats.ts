import { listEpisodeNumbers, readRss, type RssFile } from '#lib/shared/artifacts.ts';
import type { EpisodeArtifacts } from '#lib/eleventy/discover.ts';
import type {
  PodcastStats,
  EpisodeStat,
  EpisodeWordStat,
  EpisodeRateStat,
} from '#lib/eleventy/types.ts';
import { episodeUrl } from '#lib/shared/paths.ts';

/**
 * Combine the on-disk RSS sidecars with built transcript artifacts to produce
 * aggregate podcast stats. Reads only data under `episodes/`: podcast-level
 * stats span every `*.rss.json` sidecar, while transcription and fuck stats
 * span the transcribed `artifacts`.
 */
export function collectStats(artifacts: EpisodeArtifacts[]): PodcastStats {
  const rssFiles = listEpisodeNumbers().map((n) => readRss(n));

  const totalEpisodes = rssFiles.length;
  const totalDurationSeconds = rssFiles.reduce(
    (sum, rss) => sum + rss.duration.seconds,
    0,
  );
  const averageEpisodeDurationSeconds = Math.round(
    totalDurationSeconds / totalEpisodes,
  );

  const episodeStats = rssFiles.map((rss) => toEpisodeStat(rss));
  const longestEpisode = maxBy(episodeStats, (s) => s.durationSeconds);
  const shortestEpisode = minBy(episodeStats, (s) => s.durationSeconds);

  const totalTranscribedEpisodes = artifacts.length;
  const wordStats = artifacts.map((a) =>
    toEpisodeWordStat(a.rss, fullText(a).split(/\s+/u).filter(Boolean).length),
  );
  const totalTranscribedWordCount = wordStats.reduce(
    (sum, s) => sum + s.wordCount,
    0,
  );
  const averageTranscribedEpisodeWordCount = Math.round(
    totalTranscribedWordCount / totalTranscribedEpisodes,
  );
  const wordiestEpisode = maxBy(wordStats, (s) => s.wordCount);
  const leastWordiestEpisode = minBy(wordStats, (s) => s.wordCount);
  const fuckStats = artifacts.map((a) =>
    toEpisodeWordStat(a.rss, (fullText(a).match(/fuck/giu) ?? []).length),
  );
  const mostFucks = maxBy(fuckStats, (s) => s.wordCount);
  const totalFucks = fuckStats.reduce((sum, s) => sum + s.wordCount, 0);
  const averageFucks = totalFucks / totalTranscribedEpisodes;
  const rateStats = fuckStats.map((s) => toEpisodeRateStat(s));
  const mostFucksPerHour = maxBy(rateStats, (s) => s.fucksPerHour);

  return {
    totalEpisodes,
    totalDurationSeconds,
    averageEpisodeDurationSeconds,
    longestEpisode,
    shortestEpisode,
    totalTranscribedEpisodes,
    totalTranscribedWordCount,
    averageTranscribedEpisodeWordCount,
    wordiestEpisode,
    leastWordiestEpisode,
    totalFucks,
    averageFucks,
    mostFucksPerHour,
    mostFucks,
  };
}

/**
 * Return the item with the highest `value`. Throws on an empty array.
 * @example maxBy(episodes, (e) => e.durationSeconds) // longest episode
 */
function maxBy<T>(items: T[], value: (item: T) => number): T {
  return items.reduce((a, b) => (value(b) > value(a) ? b : a));
}

/**
 * Return the item with the lowest `value`. Throws on an empty array.
 * @example minBy(episodes, (e) => e.durationSeconds) // shortest episode
 */
function minBy<T>(items: T[], value: (item: T) => number): T {
  return items.reduce((a, b) => (value(b) < value(a) ? b : a));
}

function fullText(artifacts: EpisodeArtifacts): string {
  return artifacts.transcript.paragraphGroups
    .flat(2)
    .map((s) => s.text.trim())
    .join(' ');
}

function toEpisodeStat(rss: RssFile): EpisodeStat {
  return {
    episodeNumber: rss.episodeNumber,
    title: rss.title,
    pubDate: rss.pubDate,
    durationSeconds: rss.duration.seconds,
    url: episodeUrl(rss.episodeNumber),
  };
}

function toEpisodeWordStat(rss: RssFile, wordCount: number): EpisodeWordStat {
  return { ...toEpisodeStat(rss), wordCount };
}

function toEpisodeRateStat(stat: EpisodeWordStat): EpisodeRateStat {
  const fucksPerHour =
    stat.durationSeconds > 0
      ? stat.wordCount / (stat.durationSeconds / 3_600)
      : 0;
  return { ...stat, fucksPerHour };
}
