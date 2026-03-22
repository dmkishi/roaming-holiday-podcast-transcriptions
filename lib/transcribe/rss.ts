import { XMLParser } from 'fast-xml-parser';
import { parseDuration } from '@lib/duration.js';

const RSS_URL = 'https://keithcourage.com/rh/rss/rss.xml';

export interface Episode {
  episodeNumber: number;
  title: string;
  pubDate: Date;
  description: string;
  duration: string;
  durationSeconds: number;
  imageUrl: string;
  mp3Url: string;
}

interface RssItem {
  title: string;
  description: string;
  pubDate: string;
  guid: string;
  enclosure: { '@_url': string; '@_length': string };
  'itunes:duration': string;
  'itunes:image': { '@_href': string };
  'itunes:summary': string;
}

/**
 * Fetches and parses all episodes from the Roaming Holiday RSS feed.
 */
export async function fetchEpisodes(): Promise<Episode[]> {
  const response = await fetch(RSS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: HTTP ${response.status} from ${RSS_URL}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xml);

  const rawItems: RssItem[] = Array.isArray(parsed.rss.channel.item)
    ? parsed.rss.channel.item
    : [parsed.rss.channel.item];

  const episodes: Episode[] = [];

  for (const item of rawItems) {
    const episodeNumber = parseEpisodeNumber(item.guid);
    if (episodeNumber === null) continue;

    const dur = parseDuration(item['itunes:duration']);

    episodes.push({
      episodeNumber,
      title: item.title,
      pubDate: new Date(item.pubDate),
      description: (item.description ?? '').trim(),
      duration: dur.timestamp,
      durationSeconds: dur.seconds,
      imageUrl: item['itunes:image']?.['@_href'] ?? '',
      mp3Url: item.enclosure?.['@_url'] ?? item.guid,
    });
  }

  return episodes;
}

/**
 * Looks up episodes by number, returning matched episodes and any numbers not
 * found.
 */
export function findEpisodes(
  nums: number[],
  episodes: Episode[],
): { found: Episode[]; notFound: number[] } {
  const episodeMap = new Map(episodes.map((ep) => [ep.episodeNumber, ep]));
  const found: Episode[] = [];
  const notFound: number[] = [];

  for (const num of nums) {
    const ep = episodeMap.get(num);
    if (ep) {
      found.push(ep);
    } else {
      notFound.push(num);
    }
  }

  return { found, notFound };
}

/**
 * Extracts the episode number from a GUID like "...RH123.mp3", or returns null
 * if not matched.
 */
function parseEpisodeNumber(guid: string): number | null {
  const match = guid.match(/RH(\d+)\.mp3/);
  return match ? parseInt(match[1], 10) : null;
}

