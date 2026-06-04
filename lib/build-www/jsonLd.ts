import type { JsonLd, SiteEpisode } from '@lib/build-www/types.js';
import { BASE_URL, type Site } from '@lib/config/site.js';

/**
 * `PodcastSeries` for the homepage. The `@id` matches the episode pages'
 * `partOfSeries` reference, linking the two across pages.
 */
export function seriesLd(site: Pick<Site, 'descriptionHtml' | 'podcast'>, baseUrl = BASE_URL): JsonLd {
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


type EpisodeInput = Pick<
  SiteEpisode,
  | 'episodeNumber'
  | 'url'
  | 'location'
  | 'youtubeUrl'
  | 'title'
  | 'description'
  | 'mp3Url'
  | 'duration'
  | 'pubDate'
  | 'imageUrl'
>;

/**
 * `PodcastEpisode` for an episode page. `partOfSeries` is an `@id`-only
 * reference whose full node is defined by `seriesLd` on the homepage.
 */
export function episodeLd(episode: EpisodeInput, baseUrl = BASE_URL): JsonLd {
  const absUrl = `${baseUrl}${episode.url}`;
  const duration = isoDuration(episode.duration.seconds);
  const description =
    episode.description ||
    `Machine-generated transcript of Roaming Holiday episode ${episode.episodeNumber}: ${episode.title}.`;

  const data: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    '@id': `${absUrl}#episode`,
    url: absUrl,
    name: episode.title,
    episodeNumber: episode.episodeNumber,
    datePublished: episode.pubDate,
    description,
    image: episode.imageUrl,
    timeRequired: duration,
    inLanguage: 'en',
    associatedMedia: {
      '@type': 'AudioObject',
      contentUrl: episode.mp3Url,
      encodingFormat: 'audio/mpeg',
      duration,
    },
  };

  if (episode.location !== undefined && episode.location !== '') {
    data['contentLocation'] = { '@type': 'Place', name: episode.location };
  }

  if (episode.youtubeUrl !== undefined && episode.youtubeUrl !== '') {
    const videoId = new URL(episode.youtubeUrl).searchParams.get('v') ?? '';
    data['video'] = {
      '@type': 'VideoObject',
      name: episode.title,
      description,
      thumbnailUrl: episode.imageUrl,
      uploadDate: episode.pubDate,
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
        name: `#${episode.episodeNumber} ${episode.title}`,
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
