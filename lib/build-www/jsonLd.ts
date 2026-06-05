import type { JsonLd, SiteEpisode } from '#lib/build-www/types.ts';
import { BASE_URL, type Site } from '#lib/config/site.ts';

type SeriesInput = Pick<Site, 'descriptionHtml' | 'podcast'>;
type EpisodeInput = Pick<SiteEpisode, 'episodeNumber' | 'url' | 'supplement' | 'rss'>;

/**
 * `PodcastSeries` for the homepage. The `@id` matches the episode pages'
 * `partOfSeries` reference, linking the two across pages.
 */
export function seriesLd(site: SeriesInput, baseUrl = BASE_URL): JsonLd {
  const { podcast } = site;
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    '@id': `${baseUrl}/#podcast`,
    name: podcast.name,
    url: podcast.homepage,
    description: site.descriptionHtml.replaceAll(/<[^>]+>/gu, ''),
    image: podcast.image,
    author: { '@type': 'Person', name: podcast.author },
    webFeed: podcast.rssUrl,
    sameAs: Object.values(podcast.platforms),
  };
}

/**
 * `PodcastEpisode` for an episode page. `partOfSeries` is an `@id`-only
 * reference whose full node is defined by `seriesLd` on the homepage.
 */
export function episodeLd(episode: EpisodeInput, baseUrl = BASE_URL): JsonLd {
  const { supplement, rss } = episode;
  const absUrl = `${baseUrl}${episode.url}`;
  const duration = isoDuration(rss.duration.seconds);
  const description =
    rss.description ||
    `Machine-generated transcript of Roaming Holiday episode ${episode.episodeNumber}: ${rss.title}.`;

  const data: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    '@id': `${absUrl}#episode`,
    url: absUrl,
    name: rss.title,
    episodeNumber: episode.episodeNumber,
    datePublished: rss.pubDate,
    description,
    image: rss.imageUrl,
    timeRequired: duration,
    inLanguage: 'en',
    associatedMedia: {
      '@type': 'AudioObject',
      contentUrl: rss.mp3Url,
      encodingFormat: 'audio/mpeg',
      duration,
    },
  };

  if (supplement.location !== undefined && supplement.location !== '') {
    data['contentLocation'] = { '@type': 'Place', name: supplement.location };
  }

  if (supplement.youtubeUrl !== undefined && supplement.youtubeUrl !== '') {
    const videoId = new URL(supplement.youtubeUrl).searchParams.get('v') ?? '';
    data['video'] = {
      '@type': 'VideoObject',
      name: rss.title,
      description,
      thumbnailUrl: rss.imageUrl,
      uploadDate: rss.pubDate,
      duration,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    };
  }

  data['partOfSeries'] = {
    '@type': 'PodcastSeries',
    '@id': `${baseUrl}/#podcast`,
  };

  return data;
}

/**
 * `BreadcrumbList` for an episode page: Home → the episode.
 */
export function breadcrumbLd(episode: EpisodeInput, baseUrl = BASE_URL): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: `#${episode.episodeNumber} ${episode.rss.title}`,
        item: `${baseUrl}${episode.url}`,
      },
    ],
  };
}

/**
 * Format whole seconds as an ISO 8601 duration, e.g. 5491 → "PT1H31M31S".
 */
export function isoDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3_600);
  const mins = Math.floor((seconds % 3_600) / 60);
  const secs = Math.round(seconds % 60);
  let out = 'PT';
  if (hrs > 0) out += `${hrs}H`;
  if (mins > 0) out += `${mins}M`;
  out += `${secs}S`;
  return out;
}
