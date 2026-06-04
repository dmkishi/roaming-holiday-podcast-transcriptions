import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * @typedef {import('../../../lib/build-www/types.js').SiteEpisode} SiteEpisode
 */

const EPISODES_DIR = resolve(import.meta.dirname, '../_episodes');

/**
 * Reads episode JSON files from `_episodes/` and transforms them into an array
 * sorted by episode number.
 *
 * @returns {object[]} Episode objects sorted by episodeNumber.
 */
export default function loadEpisodes() {
  let files;
  try {
    files = readdirSync(EPISODES_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  return files
    .map((file) => {
      const json = readFileSync(join(EPISODES_DIR, file), 'utf8');

      // JSON.parse is `any` by design; this is the one unavoidable typed seam.
      // eslint-disable-next-line typescript/no-unsafe-type-assertion
      const episode = /** @type {SiteEpisode} */ (JSON.parse(json));

      return episode;
    })
    .toSorted((a, b) => a.episodeNumber - b.episodeNumber);
}
