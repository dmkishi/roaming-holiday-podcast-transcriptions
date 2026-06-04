import { describe, expect, test } from 'vitest';
import {
  isoDuration,
  episodeLd,
  seriesLd,
  breadcrumbLd,
} from '@lib/build-www/jsonLd.js';
import { jsonLdScriptContent } from '@lib/build-www/jsonLdScriptContent.js';
import type { SiteEpisode } from '@lib/build-www/types.js';

function makeEpisode(
  overrides: {
    supplement?: SiteEpisode['supplement'];
    rss?: Partial<SiteEpisode['rss']>;
  } = {},
) {
  return {
    episodeNumber: 1,
    url: '/episodes/1.html',
    supplement: { ...overrides.supplement },
    rss: {
      title: 'My first trip to Japan',
      description: '',
      pubDate: '2023-09-22T11:42:57.000Z',
      duration: { seconds: 5_491, timestamp: '1:31:31', human: '1h 31m 31s' },
      imageUrl: 'https://keithcourage.com/rh/images/rhlogo.jpg',
      mp3Url: 'https://keithcourage.com/rh/pod/RH0001.mp3',
      ...overrides.rss,
    },
  };
}

const site = {
  descriptionHtml:
    'This is an <i>unofficial</i> transcript site for the <a href="https://keithcourage.com/rh/">Roaming Holiday podcast</a>.',
  podcast: {
    name: 'Roaming Holiday',
    author: 'Keith McNally',
    homepage: 'https://keithcourage.com/rh/',
    rssUrl: 'https://keithcourage.com/rh/rss/rss.xml',
    image: 'https://keithcourage.com/rh/images/rhlogo.jpg',
    platforms: {
      apple: 'https://podcasts.apple.com/us/podcast/x',
      spotify: 'https://open.spotify.com/show/x',
      youtube: 'https://www.youtube.com/playlist?list=x',
    },
  },
};

describe('isoDuration', () => {
  test('hours, minutes, seconds', () => {
    expect(isoDuration(5_491)).toBe('PT1H31M31S');
  });

  test('omits zero hours and minutes but always keeps seconds', () => {
    expect(isoDuration(0)).toBe('PT0S');
    expect(isoDuration(45)).toBe('PT45S');
    expect(isoDuration(120)).toBe('PT2M0S');
  });

  test('omits zero minutes between hours and seconds', () => {
    expect(isoDuration(3_605)).toBe('PT1H5S');
  });
});

describe('episodeLd', () => {
  test('builds absolute URLs against baseUrl', () => {
    const ld = episodeLd(makeEpisode(), 'https://example.com');
    expect(ld['@id']).toBe('https://example.com/episodes/1.html#episode');
    expect(ld['url']).toBe('https://example.com/episodes/1.html');
    expect(ld['partOfSeries']).toEqual({
      '@type': 'PodcastSeries',
      '@id': 'https://example.com/#podcast',
    });
    expect(ld['timeRequired']).toBe('PT1H31M31S');
    expect(ld['associatedMedia']).toMatchObject({
      '@type': 'AudioObject',
      contentUrl: 'https://keithcourage.com/rh/pod/RH0001.mp3',
      encodingFormat: 'audio/mpeg',
      duration: 'PT1H31M31S',
    });
  });

  test('emits relative URLs when baseUrl is empty', () => {
    const ld = episodeLd(makeEpisode(), '');
    expect(ld['@id']).toBe('/episodes/1.html#episode');
    expect(ld['url']).toBe('/episodes/1.html');
    expect(ld['partOfSeries']).toMatchObject({ '@id': '/#podcast' });
  });

  test('falls back to a generated description when empty', () => {
    const ld = episodeLd(makeEpisode());
    expect(ld['description']).toBe(
      'Machine-generated transcript of Roaming Holiday episode 1: My first trip to Japan.',
    );
  });

  test('uses the supplied description when present', () => {
    const ld = episodeLd(makeEpisode({ rss: { description: 'A real description.' } }));
    expect(ld['description']).toBe('A real description.');
  });

  test('omits video and contentLocation when absent', () => {
    const ld = episodeLd(makeEpisode());
    expect(ld).not.toHaveProperty('video');
    expect(ld).not.toHaveProperty('contentLocation');
  });

  test('adds a VideoObject derived from youtubeUrl', () => {
    const ld = episodeLd(
      makeEpisode({ supplement: { youtubeUrl: 'https://www.youtube.com/watch?v=boEEK4AIt8Y' } }),
    );
    expect(ld['video']).toMatchObject({
      '@type': 'VideoObject',
      name: 'My first trip to Japan',
      embedUrl: 'https://www.youtube.com/embed/boEEK4AIt8Y',
      duration: 'PT1H31M31S',
    });
  });

  test('adds contentLocation when location is set', () => {
    const ld = episodeLd(makeEpisode({ supplement: { location: 'Taipei, Taiwan' } }));
    expect(ld['contentLocation']).toEqual({ '@type': 'Place', name: 'Taipei, Taiwan' });
  });
});

describe('seriesLd', () => {
  test('flattens platforms to sameAs and strips description tags', () => {
    const ld = seriesLd(site, 'https://example.com');
    expect(ld['@id']).toBe('https://example.com/#podcast');
    expect(ld['name']).toBe('Roaming Holiday');
    expect(ld['url']).toBe('https://keithcourage.com/rh/');
    expect(ld['webFeed']).toBe('https://keithcourage.com/rh/rss/rss.xml');
    expect(ld['author']).toEqual({ '@type': 'Person', name: 'Keith McNally' });
    expect(ld['sameAs']).toEqual([
      'https://podcasts.apple.com/us/podcast/x',
      'https://open.spotify.com/show/x',
      'https://www.youtube.com/playlist?list=x',
    ]);
    expect(ld['description']).toBe(
      'This is an unofficial transcript site for the Roaming Holiday podcast.',
    );
  });
});

describe('breadcrumbLd', () => {
  test('builds Home → episode with absolute items', () => {
    const ld = breadcrumbLd(makeEpisode(), 'https://example.com');
    expect(ld['itemListElement']).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: '#1 My first trip to Japan',
        item: 'https://example.com/episodes/1.html',
      },
    ]);
  });

  test('emits relative items when baseUrl is empty', () => {
    const ld = breadcrumbLd(makeEpisode(), '');
    expect(ld['itemListElement']).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: '#1 My first trip to Japan',
        item: '/episodes/1.html',
      },
    ]);
  });
});

describe('jsonLdScriptContent', () => {
  test('serializes JSON without wrapping markup', () => {
    const out = jsonLdScriptContent({ '@type': 'Thing' });
    expect(out).toBe('{"@type":"Thing"}');
  });

  test('escapes < to prevent a </script> breakout', () => {
    const out = jsonLdScriptContent({ name: 'a </script> b' });
    // No literal `</script>` survives in the payload, so it can't close the
    // surrounding element early.
    expect(out).not.toContain('</script>');
    // The escaped payload still parses back to the original value.
    expect(JSON.parse(out)).toEqual({ name: 'a </script> b' });
  });
});
