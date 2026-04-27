import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import {
  paths, hasMetadata, hasMarkdown, listEpisodeNumbers, readMetadata,
} from '@lib/shared/artifacts.js';
import { loadOverrides } from '@lib/shared/overrides.js';
import { toRelative } from '@lib/shared/paths.js';
import { print, printLog } from '@lib/shared/print.js';
import { pluralize } from '@lib/shared/strings.js';
import { MAX_ITEM_BYTES } from '@lib/config/cloudflare.js';
import { getUploadCliArgs } from '@lib/upload-cloudflare/cli.js';
import { loadCloudflareEnv } from '@lib/upload-cloudflare/env.js';
import { buildItemMetadata } from '@lib/upload-cloudflare/metadata.js';
import { listItemKeys, uploadItem } from '@lib/upload-cloudflare/api.js';

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
let episodeNumbers: number[];
let isAll = false;
if (opts.episodeNums === 'all') {
  isAll = true;
  episodeNumbers = listEpisodeNumbers().filter((n) => hasMarkdown(n));
} else {
  episodeNumbers = [...opts.episodeNums].toSorted((a, b) => a - b);
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
const overrides = loadOverrides();

print.info('Uploading...');
let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const n of episodeNumbers) {
  if (!hasMarkdown(n)) {
    printLog.warn(`#${n}: No transcript Markdown - skipping`);
    skipped += 1;
    continue;
  }
  if (!hasMetadata(n)) {
    printLog.warn(`#${n}: No metadata - skipping`);
    skipped += 1;
    continue;
  }

  const markdownPath = paths(n).markdown;
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

  const metadata = buildItemMetadata(readMetadata(n), overrides.get(n));
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
