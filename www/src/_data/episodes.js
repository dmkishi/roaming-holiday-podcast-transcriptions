import { buildEpisodes } from '../../../lib/build-www/buildEpisodes.ts';

/**
 * Eleventy `episodes` global: every complete episode assembled in-memory and
 * sorted by episode number. Replaces reading the generated `_episodes/*.json`
 * intermediate — `buildEpisodes` derives the same data straight from
 * `episodes/` + `episode-supplements.yaml`.
 *
 * @returns {import('../../../lib/build-www/types.js').SiteEpisode[]}
 */
export default function loadEpisodes() {
  return buildEpisodes();
}
