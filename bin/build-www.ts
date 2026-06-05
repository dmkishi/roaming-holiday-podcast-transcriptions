import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverEpisodes, type EpisodeArtifacts } from '#lib/build-www/discover.ts';
import { downloadImage } from '#lib/build-www/images.ts';
import { episodeLd, breadcrumbLd, seriesLd } from '#lib/build-www/jsonLd.ts';
import { loadSupplements } from '#lib/shared/supplements.ts';
import { collectStats } from '#lib/build-www/stats.ts';
import { addTimelineMarkers } from '#lib/build-www/timeline.ts';
import type { SiteEpisode } from '#lib/build-www/types.ts';
import { SITE_DATA_DIR, SITE_EPISODES_DIR, episodeUrl, toRelative } from '#lib/shared/paths.ts';
import { print, printLog } from '#lib/shared/print.ts';
import { formatEpisodeNumber, pluralize, toPrettyJson } from '#lib/shared/strings.ts';
import { SITE } from '#lib/config/site.ts';

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
mkdirSync(SITE_EPISODES_DIR, { recursive: true });
let built = 0;
const supplements = loadSupplements();
for (const { rss, transcript } of artifacts) {
  const ep = rss.episodeNumber;

  const image = await downloadImage(ep, rss.imageUrl);
  if (image.status === 'failed') {
    printLog.warn(`#${ep}: Image download failed - ${image.error}`);
  }

  const paragraphGroups = addTimelineMarkers(transcript.paragraphGroups);
  const supplement = supplements.get(ep);

  const fields = {
    episodeNumber: ep,
    url: episodeUrl(ep),
    imagePath: image.path,
    supplement: {
      isInterlude: supplement?.isInterlude,
      location: supplement?.location,
      youtubeUrl: supplement?.youtube,
    },
    rss: {
      title: rss.title,
      description: rss.description,
      mp3Url: rss.mp3Url,
      duration: rss.duration,
      pubDate: rss.pubDate,
      imageUrl: rss.imageUrl,
    },
    paragraphGroups,
  };
  const jsonLd = [episodeLd(fields), breadcrumbLd(fields)];
  const episode: SiteEpisode = { ...fields, jsonLd };

  const filepath = join(SITE_EPISODES_DIR, `${formatEpisodeNumber(ep)}.json`);
  writeFileSync(filepath, toPrettyJson(episode));
  printLog.info(`#${ep}: Saved "${toRelative(filepath)}"`);
  built++;
}

print.emptyLine();
printLog.info(`Built data for ${built} ${pluralize(built, 'episode')}`);

// =============================================================================
// Build site-level JSON-LD
// =============================================================================
print.emptyLine();
print.info('Building site-level JSON-LD...');
const seriesJsonLdPath = join(SITE_DATA_DIR, 'seriesJsonLd.json');
writeFileSync(seriesJsonLdPath, toPrettyJson(seriesLd(SITE)));
printLog.info(`Saved "${toRelative(seriesJsonLdPath)}"`);

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
