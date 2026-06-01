import { parseDuration } from '@lib/shared/duration.js';
import { getAllRssItems, type RssItem } from '@lib/shared/rss.js';
import type { EpisodeArtifacts } from '@lib/build-www/discover.js';
import type {
  PodcastStats,
  EpisodeStat,
  EpisodeWordStat,
  EpisodeRateStat,
} from '@lib/build-www/types.js';
import { RSS_FEED_URL } from '@lib/config/rss.js';

/**
 * Fetch the RSS feed and combine it with built artifacts to produce aggregate
 * podcast stats. Throws if the RSS feed cannot be fetched.
 */
export async function collectStats(artifacts: EpisodeArtifacts[]): Promise<PodcastStats> {
  const rss = await getAllRssItems(RSS_FEED_URL, false);
  if (rss.status === 'failed') {
    throw new Error('Failed to fetch RSS feed');
  }

  const totalEpisodes = rss.items.length;
  const totalDurationSeconds = rss.items.reduce(
    (sum, item) => sum + parseDuration(item['itunes:duration']).seconds,
    0,
  );
  const averageEpisodeDurationSeconds = Math.round(
    totalDurationSeconds / totalEpisodes,
  );

  const episodeStats = rss.items.map((item) => toEpisodeStat(item));
  const longestEpisode = episodeStats.reduce((a, b) =>
    b.durationSeconds > a.durationSeconds ? b : a,
  );
  const shortestEpisode = episodeStats.reduce((a, b) =>
    b.durationSeconds < a.durationSeconds ? b : a,
  );

  const totalTranscribedEpisodes = artifacts.length;
  const wordStats = artifacts.map((a) =>
    toEpisodeWordStat(a, fullText(a).split(/\s+/).filter(Boolean).length),
  );
  const totalTranscribedWordCount = wordStats.reduce(
    (sum, s) => sum + s.wordCount,
    0,
  );
  const averageTranscribedEpisodeWordCount = Math.round(
    totalTranscribedWordCount / totalTranscribedEpisodes,
  );
  const wordiestEpisode = wordStats.reduce((a, b) =>
    b.wordCount > a.wordCount ? b : a,
  );
  const leastWordiestEpisode = wordStats.reduce((a, b) =>
    b.wordCount < a.wordCount ? b : a,
  );
  const fuckStats = artifacts.map((a) =>
    toEpisodeWordStat(a, (fullText(a).match(/fuck/gi) ?? []).length),
  );
  const mostFucks = fuckStats.reduce((a, b) =>
    b.wordCount > a.wordCount ? b : a,
  );
  const totalFucks = fuckStats.reduce((sum, s) => sum + s.wordCount, 0);
  const averageFucks = totalFucks / totalTranscribedEpisodes;
  const rateStats = fuckStats.map((s) => toEpisodeRateStat(s));
  const mostFucksPerHour = rateStats.reduce((a, b) =>
    b.fucksPerHour > a.fucksPerHour ? b : a,
  );

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

function fullText(artifacts: EpisodeArtifacts): string {
  return artifacts.paragraph.paragraphGroups
    .flat(2)
    .map((s) => s.text.trim())
    .join(' ');
}

function toEpisodeStat(item: RssItem): EpisodeStat {
  const match = /RH(\d+)/.exec(item.guid);
  const episodeNumber = match ? Number(match[1]) : 0;
  return {
    episodeNumber,
    title: item.title,
    pubDate: new Date(item.pubDate).toISOString(),
    durationSeconds: parseDuration(item['itunes:duration']).seconds,
    url: `/episodes/${episodeNumber}.html`,
  };
}

function toEpisodeWordStat(
  artifacts: EpisodeArtifacts,
  wordCount: number,
): EpisodeWordStat {
  const { metadata } = artifacts;
  return {
    episodeNumber: metadata.episodeNumber,
    title: metadata.title,
    pubDate: metadata.pubDate,
    durationSeconds: metadata.duration.seconds,
    url: `/episodes/${metadata.episodeNumber}.html`,
    wordCount,
  };
}

function toEpisodeRateStat(stat: EpisodeWordStat): EpisodeRateStat {
  const fucksPerHour =
    stat.durationSeconds > 0
      ? stat.wordCount / (stat.durationSeconds / 3600)
      : 0;
  return { ...stat, fucksPerHour };
}
