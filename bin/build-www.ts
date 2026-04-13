import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { discoverEpisodes, type EpisodeArtifacts } from '@lib/build-www/discover.js';
// Summary-derived section matching temporarily shelved — see plan.
// import { matchSections } from '@lib/build-www/match-sections.js';
import { downloadImage } from '@lib/build-www/images.js';
import { loadOverrides } from '@lib/build-www/overrides.js';
import { collectStats } from '@lib/build-www/stats.js';
import { addTimelineMarkers } from '@lib/build-www/timeline.js';
import type { SiteEpisode } from '@lib/build-www/types.js';
import { ROOT, SITE_DATA_DIR, SITE_EPISODES_DIR } from '@lib/shared/paths.js';
import { print, printAndLog } from '@lib/shared/print.js';
import { formatEpisodeNumber, pluralize, toPrettyJson } from '@lib/shared/strings.js';

// =============================================================================
// Discover episodes
// =============================================================================
print.info('Discovering episodes...');
const discoveries = discoverEpisodes();
const artifacts: EpisodeArtifacts[] = [];
for (const result of discoveries) {
  if (result.ok) {
    artifacts.push(result.artifacts);
  } else {
    printAndLog.warn(`#${result.episodeNumber}: Skipping - ${result.reason}`);
  }
}

if (artifacts.length === 0) {
  printAndLog.warn('No complete episodes found.');
  process.exit(0);
}
printAndLog.info(`Discovered ${artifacts.length} ${pluralize(artifacts.length, 'episode')}`);
print.emptyLine();

// =============================================================================
// Build episode data
// =============================================================================
print.info('Building episode data...');
const overrides = loadOverrides();
mkdirSync(SITE_EPISODES_DIR, { recursive: true });
let built = 0;

for (const { metadata, paragraph, groupStarts } of artifacts) {
  const ep = metadata.episodeNumber;

  const image = await downloadImage(ep, metadata.imageUrl);
  if (image.status === 'failed') {
    printAndLog.warn(`#${ep}: Image download failed - ${image.error}`);
  }

  // Summary-derived section matching temporarily shelved — see plan.
  // const { sections, unmatched } = matchSections(summary.sections, paragraph.segments);
  // if (unmatched.length > 0) {
  //   printAndLog.warn([
  //     `#${ep}: ${unmatched.length} unmatched ${pluralize(unmatched.length, 'section')}:`,
  //     ...unmatched.map((title) => `  "${title}"`),
  //   ]);
  // }

  const paragraphs = addTimelineMarkers(paragraph.segments);
  const override = overrides.get(ep);

  const episode: SiteEpisode = {
    episodeNumber: ep,
    title: metadata.title,
    description: metadata.description,
    pubDate: metadata.pubDate,
    duration: metadata.duration,
    imageUrl: metadata.imageUrl,
    mp3Url: metadata.mp3Url,
    imagePath: image.path,
    paragraphs,
    groupStarts,
    // sections,
    // summary: summary.summary,
    // places: summary.places,
    // keywords: summary.keywords,
    location: override?.location,
    youtube: override?.youtube,
  };

  const filepath = join(SITE_EPISODES_DIR, `${formatEpisodeNumber(ep)}.json`);
  writeFileSync(filepath, toPrettyJson(episode));
  printAndLog.info(`#${ep}: Saved "${relative(ROOT, filepath)}"`);
  built++;
}

print.emptyLine();
printAndLog.info(`Built data for ${built} ${pluralize(built, 'episode')}`);

// =============================================================================
// Collect and write stats
// =============================================================================
print.emptyLine();
print.info('Collecting stats...');
try {
  const stats = await collectStats(artifacts);
  const statsPath = join(SITE_DATA_DIR, 'stats.json');
  writeFileSync(statsPath, toPrettyJson(stats));
  printAndLog.info(`Saved "${relative(ROOT, statsPath)}"`);
} catch (error) {
  printAndLog.warn(`Stats collection failed: ${error instanceof Error ? error.message : String(error)}`);
}
