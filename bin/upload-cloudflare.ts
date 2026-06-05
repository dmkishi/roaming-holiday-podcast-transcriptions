import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { hasRss, readRss } from '#lib/shared/artifacts.ts';
import { loadSupplements } from '#lib/shared/supplements.ts';
import { SITE_DIST_EPISODES_DIR, toRelative } from '#lib/shared/paths.ts';
import { print, printLog } from '#lib/shared/print.ts';
import { pluralize } from '#lib/shared/strings.ts';
import { MAX_ITEM_BYTES } from '#lib/config/cloudflare.ts';
import { getUploadCliArgs } from '#lib/upload-cloudflare/cli.ts';
import { loadCloudflareEnv } from '#lib/upload-cloudflare/env.ts';
import { buildItemMetadata } from '#lib/upload-cloudflare/metadata.ts';
import { listItemKeys, uploadItem } from '#lib/upload-cloudflare/api.ts';

// =============================================================================
// Parse CLI args + env
// =============================================================================
const opts = getUploadCliArgs(process.argv);

const envResult = loadCloudflareEnv();
if (!envResult.ok) {
  printLog.error(`Missing required env vars: ${envResult.missing.join(', ')}`);
  process.exit(1);
}
const env = envResult.env;

// =============================================================================
// Resolve episode set
// =============================================================================
const markdownPathFor = (n: number): string => join(SITE_DIST_EPISODES_DIR, `${n}.md`);

let episodeNumbers: number[];
let isAll = false;
if (opts.episodeNums === 'all') {
  isAll = true;
  episodeNumbers = listSiteEpisodeNumbers();
} else {
  episodeNumbers = [...opts.episodeNums].toSorted((a, b) => a - b);
}

/**
 * Returns sorted episode numbers from the www build's `episodes/<n>.md` files.
 */
function listSiteEpisodeNumbers(): number[] {
  if (!existsSync(SITE_DIST_EPISODES_DIR)) return [];
  const numbers: number[] = [];
  for (const file of readdirSync(SITE_DIST_EPISODES_DIR)) {
    if (!file.endsWith('.md')) continue;
    const n = Number(file.slice(0, -'.md'.length));
    if (Number.isInteger(n) && n > 0) numbers.push(n);
  }
  return numbers.toSorted((a, b) => a - b);
}

if (episodeNumbers.length === 0) {
  printLog.error('No episodes to upload.');
  process.exit(1);
}

const banner = isAll
  ? `Upload ${pluralize(episodeNumbers.length, 'episode')} (all): ${episodeNumbers.join(', ')}`
  : `Upload ${pluralize(episodeNumbers.length, 'episode')}: ${episodeNumbers.join(', ')}`;
printLog.info(banner);
print.emptyLine();

// =============================================================================
// List existing keys (skip-if-exists)
// =============================================================================
let existingKeys = new Set<string>();
if (!opts.force) {
  print.info('Listing existing items...');
  const listRes = await listItemKeys(env);
  if (!listRes.ok) {
    printLog.error(`Failed to list items: ${listRes.error}`);
    process.exit(1);
  }
  existingKeys = listRes.keys;
  printLog.info(`Found ${existingKeys.size} existing ${pluralize(existingKeys.size, 'item')}`);
  print.emptyLine();
}

// =============================================================================
// Upload
// =============================================================================
const supplements = loadSupplements();

print.info('Uploading...');
let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const n of episodeNumbers) {
  const markdownPath = markdownPathFor(n);
  if (!existsSync(markdownPath)) {
    printLog.warn(`#${n}: No transcript Markdown - skipping`);
    skipped += 1;
    continue;
  }
  if (!hasRss(n)) {
    printLog.warn(`#${n}: No RSS data - skipping`);
    skipped += 1;
    continue;
  }

  const key = basename(markdownPath);

  if (!opts.force && existingKeys.has(key)) {
    printLog.warn(`#${n}: Already indexed - skipping (use --force to overwrite)`);
    skipped += 1;
    continue;
  }

  const size = statSync(markdownPath).size;
  if (size > MAX_ITEM_BYTES) {
    printLog.warn(`#${n}: File ${size} bytes exceeds ${MAX_ITEM_BYTES} byte limit - skipping`);
    skipped += 1;
    continue;
  }

  const metadata = buildItemMetadata(readRss(n), supplements.get(n));
  const bytes = readFileSync(markdownPath);

  const res = await uploadItem(env, key, bytes, metadata);
  if (!res.ok) {
    printLog.warn(`#${n}: Failed - ${res.error}`);
    failed += 1;
    continue;
  }

  printLog.info(`#${n}: Uploaded "${toRelative(markdownPath)}" (id: ${res.id})`);
  uploaded += 1;
}

print.emptyLine();
printLog.info(
  `Done. Uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed}.`,
);
if (failed > 0) process.exit(1);
