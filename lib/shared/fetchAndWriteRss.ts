import { writeRss } from '#lib/shared/artifacts.ts';
import { findEpisodes, type Episode } from '#lib/shared/episode.ts';
import { getAllRssItems } from '#lib/shared/rss.ts';
import { RSS_FEED_URL } from '#lib/config/rss.ts';

interface FoundSidecar {
  episode: Episode;
  filepath: string;
  changed: boolean;
}

type FetchAndWriteRssResult =
  | { status: 'failed' }
  | {
      status: 'ok';
      feedStatus: 'downloaded' | 'cached';
      itemCount: number;
      found: FoundSidecar[];
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
  const foundNums = new Set(episodes.map((e) => e.episodeNumber));
  const missing = [...episodeNums].filter((num) => !foundNums.has(num));

  const found = episodes.map((episode) => {
    const { path, changed } = writeRss(episode.episodeNumber, {
      ...episode,
      pubDate: episode.pubDate.toISOString(),
    });
    return { episode, filepath: path, changed };
  });

  return {
    status: 'ok',
    feedStatus: feed.status,
    itemCount: feed.items.length,
    found,
    missing,
  };
}
