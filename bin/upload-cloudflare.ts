/**
 * Uploads built episode transcript Markdown to Cloudflare for indexing.
 *
 * Resolves an episode set (default to all episodes, or explicit numbers and
 * ranges), then for each episode uploads its transcript with metadata derived
 * from RSS and supplements. Episodes already indexed are skipped unless
 * `--force` is given; episodes missing a transcript or RSS data, or exceeding
 * the per-item byte limit, are skipped. Exits non-zero on env, listing, or any
 * upload failure.
 *
 * Usage: `upload-cloudflare [<episode-numbers...>] [--force]`
 *        Episode numbers accept ranges, e.g. `100 101 120-129`. When omitted,
 *        every episode with RSS + transcript artifacts is uploaded.
 */
import {
  hasRss,
  hasTranscript,
  listEpisodeNumbers,
  readRss,
  readTranscript,
} from '#lib/shared/artifacts.ts';
import { renderEpisodeMarkdown } from '#lib/shared/episodeMarkdown.ts';
import { loadSupplements } from '#lib/shared/supplements.ts';
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
const argsResult = getUploadCliArgs(process.argv);
if (!argsResult.ok) {
  printLog.error(argsResult.error);
  process.exit(1);
}
const opts = argsResult.opts;

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
  episodeNumbers = listEpisodeNumbers();
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
const supplements = loadSupplements();

print.info('Uploading...');
let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const n of episodeNumbers) {
  if (!hasRss(n)) {
    printLog.warn(`#${n}: No RSS data - skipping`);
    skipped += 1;
    continue;
  }
  if (!hasTranscript(n)) {
    printLog.warn(`#${n}: No transcript - skipping`);
    skipped += 1;
    continue;
  }
  const transcript = readTranscript(n);
  if (transcript.paragraphGroups.length === 0) {
    printLog.warn(`#${n}: No paragraph groups in transcript - skipping`);
    skipped += 1;
    continue;
  }

  const key = `${n}.md`;

  if (!opts.force && existingKeys.has(key)) {
    printLog.warn(`#${n}: Already indexed - skipping (use --force to overwrite)`);
    skipped += 1;
    continue;
  }

  const rss = readRss(n);
  const md = renderEpisodeMarkdown({ ...rss, episodeNumber: n }, transcript.paragraphGroups);
  const bytes = Buffer.from(md, 'utf8');
  if (bytes.length > MAX_ITEM_BYTES) {
    printLog.warn(`#${n}: ${bytes.length} bytes exceeds ${MAX_ITEM_BYTES} byte limit - skipping`);
    skipped += 1;
    continue;
  }

  const metadata = buildItemMetadata(rss, supplements.get(n));

  const res = await uploadItem(env, key, bytes, metadata);
  if (!res.ok) {
    printLog.warn(`#${n}: Failed - ${res.error}`);
    failed += 1;
    continue;
  }

  printLog.info(`#${n}: Uploaded (id: ${res.id})`);
  uploaded += 1;
}

print.emptyLine();
printLog.info(
  `Done. Uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed}.`,
);
if (failed > 0) process.exit(1);
