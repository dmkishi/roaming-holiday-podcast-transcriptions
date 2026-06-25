import { discoverArtifactsOnce } from '../../../lib/build-www/discover.ts';
import { collectStats } from '../../../lib/build-www/stats.ts';

/**
 * Eleventy `stats` global: aggregate podcast stats derived in-memory from the
 * discovered episode artifacts. Replaces the generated `_data/stats.json`.
 *
 * @returns {import('../../../lib/build-www/types.js').PodcastStats}
 */
export default function loadStats() {
  return collectStats(discoverArtifactsOnce());
}
