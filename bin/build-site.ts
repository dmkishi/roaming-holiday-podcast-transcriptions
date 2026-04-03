import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_EPISODES_DIR } from '@lib/config/paths.js';
import { formatEpisodeNumber } from '@lib/shared/paths.js';
import { discoverEpisodes } from '@lib/build-site/discover.js';
import { matchSections } from '@lib/build-site/match-sections.js';
import { downloadImage } from '@lib/build-site/images.js';
import { loadOverrides } from '@lib/build-site/overrides.js';
import { addTimelineMarkers } from '@lib/build-site/timeline.js';
import type { SiteEpisode } from '@lib/build-site/types.js';

const artifacts = discoverEpisodes();

if (artifacts.length === 0) {
  console.warn('[build-site] No complete episodes found in outputs/');
  process.exit(0);
}

const overrides = loadOverrides();
mkdirSync(SITE_EPISODES_DIR, { recursive: true });
let count = 0;

for (const { metadata, transcript, summary } of artifacts) {
  const ep = metadata.episodeNumber;
  const sections = matchSections(summary.sections, transcript.segments);
  const imagePath = await downloadImage(ep, metadata.imageUrl);
  const segments = addTimelineMarkers(transcript.segments);
  const override = overrides.get(ep);

  const episode: SiteEpisode = {
    episodeNumber: ep,
    title: metadata.title,
    description: metadata.description,
    pubDate: metadata.pubDate,
    duration: metadata.duration,
    imageUrl: metadata.imageUrl,
    mp3Url: metadata.mp3Url,
    imagePath,
    segments,
    sections,
    summary: summary.summary,
    places: summary.places,
    keywords: summary.keywords,
    location: override?.location,
    youtube: override?.youtube,
  };

  const filename = `${formatEpisodeNumber(ep)}.json`;
  writeFileSync(
    join(SITE_EPISODES_DIR, filename),
    JSON.stringify(episode, undefined, 2) + '\n',
  );
  count++;
}

console.log(`[build-site] Built data for ${count} episode(s)`);
