import type { RssFile } from '@lib/shared/artifacts.js';
import type { EpisodeSupplement } from '@lib/shared/supplements.js';
import { formatDate } from '@lib/shared/strings.js';
import { episodeUrl } from '@lib/shared/paths.js';
import { BASE_URL } from '@lib/config/site.js';

export function buildItemMetadata(
  rss: RssFile,
  supplement: EpisodeSupplement | undefined,
): Record<string, string> {
  const result: Record<string, string> = {
    title: `Episode ${rss.episodeNumber}: ${rss.title}`,
    publish_date: formatDate(new Date(rss.pubDate)),
    url: `${BASE_URL}${episodeUrl(rss.episodeNumber)}`,
  };
  const location = supplement?.location;
  if (location !== undefined && location !== '') {
    result['location'] = location;
  }
  return result;
}
