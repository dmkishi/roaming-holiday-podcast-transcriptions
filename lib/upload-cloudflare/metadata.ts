import type { MetadataFile } from '@lib/shared/artifacts.js';
import type { EpisodeOverride } from '@lib/shared/overrides.js';
import { formatDate } from '@lib/shared/strings.js';
import { SITE_BASE_URL } from '@lib/config/cloudflare.js';

export function buildItemMetadata(
  metadata: MetadataFile,
  override: EpisodeOverride | undefined,
): Record<string, string> {
  const result: Record<string, string> = {
    title: `Episode ${metadata.episodeNumber}: ${metadata.title}`,
    publish_date: formatDate(new Date(metadata.pubDate)),
    url: `${SITE_BASE_URL}/episodes/${metadata.episodeNumber}.html`,
  };
  const location = override?.location;
  if (location !== undefined && location !== '') {
    result['location'] = location;
  }
  return result;
}
