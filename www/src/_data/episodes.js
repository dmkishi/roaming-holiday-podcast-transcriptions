import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const EPISODES_DIR = resolve(import.meta.dirname, '../_episodes');

/**
 * Reads episode JSON files from `_episodes/` and transforms them into an array
 * sorted by episode number.
 *
 * @returns {object[]} Episode objects sorted by episodeNumber.
 */
export default function() {
  let files;
  try {
    files = readdirSync(EPISODES_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  return files
    .map((f) => {
      const episode = JSON.parse(readFileSync(join(EPISODES_DIR, f), 'utf8'));
      return { ...episode, url: `/episodes/${episode.episodeNumber}.html` };
    })
    .toSorted((a, b) => a.episodeNumber - b.episodeNumber);
}
