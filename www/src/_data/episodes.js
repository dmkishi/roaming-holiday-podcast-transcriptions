import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const EPISODES_DIR = resolve(import.meta.dirname, '../_episodes');

export default function () {
  let files;
  try {
    files = readdirSync(EPISODES_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  return files
    .map((f) => JSON.parse(readFileSync(join(EPISODES_DIR, f), 'utf8')))
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
}
