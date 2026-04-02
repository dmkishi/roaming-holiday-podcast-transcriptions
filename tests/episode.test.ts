import { describe, expect, test } from 'vitest';
import { findEpisodes } from '@lib/episode.js';
import type { RssItem } from '@lib/rss.js';

function makeItem(overrides: Partial<RssItem> & { guid: string }): RssItem {
  return {
    title: 'Test Episode',
    pubDate: 'Mon, 01 Jan 2025 00:00:00 GMT',
    enclosure: { '@_url': 'https://example.com/ep.mp3', '@_length': '1000' },
    'itunes:duration': '1:23:45',
    'itunes:image': { '@_href': 'https://example.com/img.jpg' },
    'itunes:summary': 'A summary',
    ...overrides,
  };
}

const items: RssItem[] = [
  makeItem({ guid: 'RH001', title: 'Episode One', description: 'First' }),
  makeItem({ guid: 'RH002', title: 'Episode Two', description: 'Second' }),
  makeItem({ guid: 'RH010', title: 'Episode Ten' }),
  makeItem({ guid: 'no-match', title: 'Bonus' }),
];

function getSingleEpisode(episodes: ReturnType<typeof findEpisodes>) {
  const [episode] = episodes;
  if (!episode) {
    throw new Error('Expected exactly one episode');
  }
  return episode;
}

describe('findEpisodes', () => {
  test('returns only episodes matching the requested numbers', () => {
    const episodes = findEpisodes(items, new Set([1, 10]));
    expect(episodes).toHaveLength(2);
    expect(episodes.map((e) => e.episodeNumber)).toEqual([1, 10]);
  });

  test('extracts episode number from guid', () => {
    const episode = getSingleEpisode(findEpisodes(items, new Set([2])));
    expect(episode.episodeNumber).toBe(2);
  });

  test('maps title and description', () => {
    const episode = getSingleEpisode(findEpisodes(items, new Set([1])));
    expect(episode.title).toBe('Episode One');
    expect(episode.description).toBe('First');
  });

  test('defaults description to empty string when undefined', () => {
    const episode = getSingleEpisode(findEpisodes(items, new Set([10])));
    expect(episode.description).toBe('');
  });

  test('parses pubDate into a Date', () => {
    const episode = getSingleEpisode(findEpisodes(items, new Set([1])));
    expect(episode.pubDate).toBeInstanceOf(Date);
    expect(episode.pubDate.getUTCFullYear()).toBe(2025);
  });

  test('parses duration', () => {
    const episode = getSingleEpisode(findEpisodes(items, new Set([1])));
    expect(episode.duration.seconds).toBe(5025);
    expect(episode.duration.timestamp).toBe('1:23:45');
  });

  test('extracts mp3 and image URLs', () => {
    const episode = getSingleEpisode(findEpisodes(items, new Set([1])));
    expect(episode.mp3Url).toBe('https://example.com/ep.mp3');
    expect(episode.imageUrl).toBe('https://example.com/img.jpg');
  });

  test('skips items with non-matching guid format', () => {
    const episodes = findEpisodes(items, new Set([999]));
    expect(episodes).toHaveLength(0);
  });

  test('returns empty array when no numbers match', () => {
    const episodes = findEpisodes(items, new Set([99, 100]));
    expect(episodes).toEqual([]);
  });

  test('returns empty array for empty input', () => {
    const episodes = findEpisodes([], new Set([1]));
    expect(episodes).toEqual([]);
  });
});
