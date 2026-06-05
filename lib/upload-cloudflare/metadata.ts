import type { RssFile } from '#lib/shared/artifacts.ts';
import type { EpisodeSupplement } from '#lib/shared/supplements.ts';
import { formatDate } from '#lib/shared/strings.ts';
import { episodeUrl } from '#lib/shared/paths.ts';
import { BASE_URL } from '#lib/config/site.ts';

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
