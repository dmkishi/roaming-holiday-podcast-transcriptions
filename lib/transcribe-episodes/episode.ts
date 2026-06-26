import { type Duration, parseDuration } from '#lib/shared/duration.ts';
import type { RssItem } from '#lib/shared/rss.ts';
import { sanitizeRssText } from '#lib/shared/sanitizeRssText.ts';

export interface Episode {
  episodeNumber: number;
  title: string;
  description: string;
  pubDate: Date;
  duration: Duration;
  imageUrl: string;
  mp3Url: string;
}

export function findEpisodes(
  rssItems: RssItem[],
  episodeNumbers: Set<number>,
): Episode[] {
  const episodes: Episode[] = [];

  for (const item of rssItems) {
    const match = /RH(?<num>\d+)/u.exec(item.guid);
    if (!match) continue;

    const episodeNumber = Number(match.groups?.['num']);
    if (!episodeNumbers.has(episodeNumber)) continue;

    episodes.push({
      episodeNumber,
      title: sanitizeRssText(item.title),
      description: sanitizeRssText(item.description ?? ''),
      pubDate: new Date(item.pubDate),
      duration: parseDuration(item['itunes:duration']),
      imageUrl: item['itunes:image']['@_href'],
      mp3Url: item.enclosure['@_url'],
    });
  }

  return episodes;
}
