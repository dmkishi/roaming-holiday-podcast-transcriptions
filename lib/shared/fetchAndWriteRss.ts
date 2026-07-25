import { writeRss } from '#lib/shared/artifacts.ts';
import { findEpisodes, type Episode } from '#lib/shared/episode.ts';
import { getAllRssItems } from '#lib/shared/rss.ts';
import { RSS_FEED_URL } from '#lib/config/rss.ts';

interface WrittenSidecar {
  episode: Episode;
  filepath: string;
}

type FetchAndWriteRssResult =
  | { status: 'failed' }
  | {
      status: 'ok';
      feedStatus: 'downloaded' | 'cached';
      itemCount: number;
      written: WrittenSidecar[];
      missing: number[];
    };

/**
 * Fetch the RSS feed once and write an `NNN.rss.json` sidecar for each
 * requested episode found in the feed. Returns a structured result.
 */
export async function fetchAndWriteRss(
  episodeNums: Set<number>,
  forceRss: boolean,
): Promise<FetchAndWriteRssResult> {
  const feed = await getAllRssItems(RSS_FEED_URL, forceRss);
  if (feed.status === 'failed') return { status: 'failed' };

  const episodes = findEpisodes(feed.items, episodeNums);
  const found = new Set(episodes.map((e) => e.episodeNumber));
  const missing = [...episodeNums].filter((num) => !found.has(num));

  const written = episodes.map((episode) => ({
    episode,
    filepath: writeRss(episode.episodeNumber, {
      ...episode,
      pubDate: episode.pubDate.toISOString(),
    }).path,
  }));

  return {
    status: 'ok',
    feedStatus: feed.status,
    itemCount: feed.items.length,
    written,
    missing,
  };
}
