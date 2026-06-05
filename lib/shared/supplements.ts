import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { ROOT } from '#lib/shared/paths.js';

const EpisodeSupplementSchema = z.object({
  location: z.string().optional(),
  youtube: z.url().optional(),
  isInterlude: z.boolean().optional(),
});

const SupplementsFileSchema = z.record(z.coerce.number(), EpisodeSupplementSchema);

export type EpisodeSupplement = z.infer<typeof EpisodeSupplementSchema>;

const SUPPLEMENTS_PATH = resolve(ROOT, 'episode-supplements.yaml');

/**
 * Loads per-episode supplemental metadata from `episode-supplements.yaml`,
 * keyed by episode number. Provides manual data (location, YouTube URL) that
 * isn't automatically discoverable from the RSS feed.
 */
export function loadSupplements(): Map<number, EpisodeSupplement> {
  if (!existsSync(SUPPLEMENTS_PATH)) return new Map();

  const raw = readFileSync(SUPPLEMENTS_PATH, 'utf8');
  const parsed = SupplementsFileSchema.parse(parse(raw));
  const map = new Map<number, EpisodeSupplement>();

  for (const [key, value] of Object.entries(parsed)) {
    map.set(Number(key), value);
  }

  return map;
}
