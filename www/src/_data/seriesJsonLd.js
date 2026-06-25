import { seriesLd } from '../../../lib/build-www/jsonLd.ts';
import { SITE } from '../../../lib/config/site.ts';

/**
 * Eleventy `seriesJsonLd` global: the homepage `PodcastSeries` JSON-LD, derived
 * in-memory from `SITE`. Replaces the generated `_data/seriesJsonLd.json`.
 *
 * @returns {import('../../../lib/build-www/types.js').JsonLd}
 */
export default function loadSeriesJsonLd() {
  return seriesLd(SITE);
}
