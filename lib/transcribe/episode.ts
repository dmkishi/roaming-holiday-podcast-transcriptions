import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RssItem } from '@lib/transcribe/rss.js';
import { type Duration, parseDuration } from '@lib/shared/duration.js';
import { episodePaths } from '@lib/transcribe/paths.js';

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
    const match = /RH(\d+)/.exec(item.guid);
    if (!match) continue;

    const episodeNumber = Number(match[1]);
    if (!episodeNumbers.has(episodeNumber)) continue;

    episodes.push({
      episodeNumber,
      title: item.title,
      description: item.description ?? '',
      pubDate: new Date(item.pubDate),
      duration: parseDuration(item['itunes:duration']),
      imageUrl: item['itunes:image']['@_href'],
      mp3Url: item.enclosure['@_url'],
    });
  }

  return episodes;
}

export function saveMetadata(
  episode: Episode,
): string {
  const { metadata: filepath } = episodePaths({ episodeNumber: episode.episodeNumber, model: '' });
  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, JSON.stringify(episode, undefined, 2) + '\n');
  return filepath;
}
