import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { SITE_DIR } from '@lib/shared/paths.js';

const EpisodeOverrideSchema = z.object({
  location: z.string().optional(),
  youtube: z.url().optional(),
});

const OverridesFileSchema = z.record(z.coerce.number(), EpisodeOverrideSchema);

export type EpisodeOverride = z.infer<typeof EpisodeOverrideSchema>;

const OVERRIDES_PATH = resolve(SITE_DIR, 'episodes.yaml');

export function loadOverrides(): Map<number, EpisodeOverride> {
  if (!existsSync(OVERRIDES_PATH)) return new Map();

  const raw = readFileSync(OVERRIDES_PATH, 'utf8');
  const parsed = OverridesFileSchema.parse(parse(raw));
  const map = new Map<number, EpisodeOverride>();

  for (const [key, value] of Object.entries(parsed)) {
    map.set(Number(key), value);
  }

  return map;
}
