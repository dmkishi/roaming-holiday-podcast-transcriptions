import type { MetadataFile } from '@lib/shared/artifacts.js';
import type { EpisodeSupplement } from '@lib/shared/supplements.js';
import { formatDate } from '@lib/shared/strings.js';
import { episodeUrl } from '@lib/shared/paths.js';
import { BASE_URL } from '@lib/config/site.js';

export function buildItemMetadata(
  metadata: MetadataFile,
  supplement: EpisodeSupplement | undefined,
): Record<string, string> {
  const result: Record<string, string> = {
    title: `Episode ${metadata.episodeNumber}: ${metadata.title}`,
    publish_date: formatDate(new Date(metadata.pubDate)),
    url: `${BASE_URL}${episodeUrl(metadata.episodeNumber)}`,
  };
  const location = supplement?.location;
  if (location !== undefined && location !== '') {
    result['location'] = location;
  }
  return result;
}
