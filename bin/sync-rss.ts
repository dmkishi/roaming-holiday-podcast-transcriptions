import minimist from 'minimist';
import pc from 'picocolors';
import { parseEpisodeNums } from '#lib/shared/episodeArgs.ts';
import { fetchAndWriteRss } from '#lib/shared/fetchAndWriteRss.ts';
import { listEpisodeNumbers } from '#lib/shared/artifacts.ts';
import { toRelative } from '#lib/shared/paths.ts';
import { print, printLog } from '#lib/shared/print.ts';
import { RSS_FEED_URL } from '#lib/config/rss.ts';
import { formatDate, pluralize } from '#lib/shared/strings.ts';

// =============================================================================
// CLI
// =============================================================================
const argv = minimist<{ 'force-rss': boolean }>(process.argv.slice(2), {
  boolean: ['force-rss'],
  default: { 'force-rss': false },
});

const usage = `Usage: pnpm sync-rss [episodes...] [--force-rss]
       [episodes...] accepts integers and ranges; omit to refresh every sidecar`;

// allowEmpty: true — "no args" means "all committed sidecars".
const parsed = parseEpisodeNums(argv._.map(String), { allowEmpty: true });
if ('error' in parsed) {
  printLog.error(`${parsed.error}\n${usage}`);
  process.exit(1);
}
const cli = { episodeNums: parsed.episodeNums, forceRss: argv['force-rss'] };

// =============================================================================
// Main
// =============================================================================
// Explicit args → create-or-update those episodes (may create new sidecars).
// No args       → refresh only episodes that already have a committed sidecar.
const episodeNums = cli.episodeNums.size > 0
  ? cli.episodeNums
  : new Set(listEpisodeNumbers());

if (episodeNums.size === 0) {
  printLog.error('No committed sidecars to refresh.');
  process.exit(1);
}

// Fetch RSS feed and write RSS sidecar file(s) --------------------------------
print.info('Fetching RSS feed...');
const rss = await fetchAndWriteRss(episodeNums, cli.forceRss);
if (rss.status === 'failed') {
  printLog.error(`Failed to fetch RSS feed <${RSS_FEED_URL}>`);
  process.exit(1);
}
printLog.info(`RSS feed: ${rss.itemCount} items (${pc.blue(rss.feedStatus)})`);

if (rss.missing.length > 0) {
  if (rss.found.length === 0) {
    printLog.error('No episodes found');
    process.exit(1);
  }
  printLog.warn(
    `${pluralize(rss.missing.length, 'Episode')} NOT found: ${rss.missing.map((num) => pc.red(num)).join(', ')}`,
  );
} else {
  printLog.info(
    `Found all requested ${pluralize(rss.found.length, 'episode')}: ${rss.found.map((f) => f.episode.episodeNumber).join(', ')}`,
  );
}

const written = rss.found.filter((f) => f.changed);
const unchanged = rss.found.filter((f) => !f.changed);

for (const { episode, filepath } of written) {
  printLog.info([
    `#${episode.episodeNumber}: Saved "${toRelative(filepath)}"`,
    `  Title:        "${episode.title}"`,
    `  Publish date: ${formatDate(episode.pubDate)}`,
  ]);
}

if (unchanged.length > 0) {
  printLog.info(
    `${pluralize(unchanged.length, 'Episode')} unchanged (skipped): ${unchanged.map((f) => f.episode.episodeNumber).join(', ')}`,
  );
}
