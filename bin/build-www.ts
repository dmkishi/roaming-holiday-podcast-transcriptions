import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverEpisodes, type EpisodeArtifacts } from '@lib/build-www/discover.js';
import { downloadImage } from '@lib/build-www/images.js';
import { loadSupplements } from '@lib/shared/supplements.js';
import { collectStats } from '@lib/build-www/stats.js';
import { addTimelineMarkers } from '@lib/build-www/timeline.js';
import type { SiteEpisode } from '@lib/build-www/types.js';
import { SITE_DATA_DIR, SITE_EPISODES_DIR, toRelative } from '@lib/shared/paths.js';
import { print, printLog } from '@lib/shared/print.js';
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
    printLog.warn(`#${result.episodeNumber}: Skipping - ${result.reason}`);
  }
}

if (artifacts.length === 0) {
  printLog.warn('No complete episodes found.');
  process.exit(0);
}
printLog.info(`Discovered ${artifacts.length} ${pluralize(artifacts.length, 'episode')}`);
print.emptyLine();

// =============================================================================
// Build episode data
// =============================================================================
print.info('Building episode data...');
const supplements = loadSupplements();
mkdirSync(SITE_EPISODES_DIR, { recursive: true });
let built = 0;

for (const { metadata, paragraph, fadePairStarts } of artifacts) {
  const ep = metadata.episodeNumber;

  const image = await downloadImage(ep, metadata.imageUrl);
  if (image.status === 'failed') {
    printLog.warn(`#${ep}: Image download failed - ${image.error}`);
  }

  const paragraphs = addTimelineMarkers(paragraph.segments);
  const supplement = supplements.get(ep);

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
    fadePairStarts,
    location: supplement?.location,
    youtube: supplement?.youtube,
    isInterlude: supplement?.isInterlude,
  };

  const filepath = join(SITE_EPISODES_DIR, `${formatEpisodeNumber(ep)}.json`);
  writeFileSync(filepath, toPrettyJson(episode));
  printLog.info(`#${ep}: Saved "${toRelative(filepath)}"`);
  built++;
}

print.emptyLine();
printLog.info(`Built data for ${built} ${pluralize(built, 'episode')}`);

// =============================================================================
// Collect and write stats
// =============================================================================
print.emptyLine();
print.info('Collecting stats...');
try {
  const stats = await collectStats(artifacts);
  const statsPath = join(SITE_DATA_DIR, 'stats.json');
  writeFileSync(statsPath, toPrettyJson(stats));
  printLog.info(`Saved "${toRelative(statsPath)}"`);
} catch (error) {
  printLog.warn(`Stats collection failed: ${error instanceof Error ? error.message : String(error)}`);
}
