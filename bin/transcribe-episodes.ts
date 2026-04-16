import pc from 'picocolors';
import { readFileSync } from 'node:fs';
import { getTranscribeCliArgs } from '@lib/transcribe-episodes/cli.js';
import { getAllRssItems } from '@lib/shared/rss.js';
import { findEpisodes, saveMetadata } from '@lib/transcribe-episodes/episode.js';
import { downloadMp3 } from '@lib/transcribe-episodes/mp3.js';
import { runVad } from '@lib/transcribe-episodes/audioVad.js';
import {
  makeToTranscribe, promptTranscript, PROMPT_TOKEN_LIMIT,
  type ToTranscribe, type Transcript,
} from '@lib/transcribe-episodes/transcript.js';
import { writeParagraphs } from '@lib/transcribe-episodes/paragraph.js';
import { writeParagraphGroups } from '@lib/transcribe-episodes/paragraphGroup.js';
import { promptSummary, type Summary } from '@lib/transcribe-episodes/summary.js';
import { episodePaths, findTranscript } from '@lib/transcribe-episodes/paths.js';
import { MetadataFileSchema } from '@lib/shared/schemas.js';
import { formatDate, formatNumber, pluralize } from '@lib/shared/strings.js';
import { toRelative } from '@lib/shared/paths.js';
import { print, printLog } from '@lib/shared/print.js';
import { RSS_FEED_URL } from '@lib/config/rss.js';

// Shared shape consumed by paragraph, paragraphGroup, and summarize stages.
interface TailItem {
  episodeNumber: number;
  path: string;
  title: string;
  description: string;
}

// =============================================================================
// Parse CLI args
// =============================================================================
const opts = getTranscribeCliArgs(process.argv);
const { runTranscript, runParagraph, runSummary } = opts.runPipeline;
const modeLabel = runTranscript && runParagraph && runSummary
  ? 'full pipeline'
  : `${[runParagraph && 'paragraph', runSummary && 'summary'].filter(Boolean).join(' + ')} only`;

const banner = [
  `Transcribe ${pluralize(opts.episodeNums.size, 'episode')} (${modeLabel}): ${[...opts.episodeNums].join(', ')}`,
];
if (runTranscript) banner.push(`  Whisper model: ${opts.transcribeModel}`);
if (runSummary) banner.push(`  Summary model: ${opts.summaryModel}`);
printLog.info(banner);
print.emptyLine();

const tailItems: TailItem[] = runTranscript
  ? await runTranscriptPipeline()
  : loadTranscriptsFromDisk();

// =============================================================================
// Load transcripts from disk
// =============================================================================
function loadTranscriptsFromDisk(): TailItem[] {
  print.info('Loading existing transcripts...');
  const items: TailItem[] = [];
  for (const episodeNumber of opts.episodeNums) {
    const path = findTranscript(episodeNumber);
    if (path === undefined) {
      printLog.warn(`#${episodeNumber}: No transcript found - skipping`);
      continue;
    }

    let title = '';
    let description = '';
    if (runSummary) {
      const { metadata: metadataPath } = episodePaths(episodeNumber);
      try {
        ({ title, description } = MetadataFileSchema.parse(
          JSON.parse(readFileSync(metadataPath, 'utf8')),
        ));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        printLog.warn(`#${episodeNumber}: Failed to load metadata - ${msg} - skipping`);
        continue;
      }
    }

    items.push({ episodeNumber, path, title, description });
    printLog.info(`#${episodeNumber}: Loaded "${toRelative(path)}"`);
  }

  if (items.length === 0) {
    printLog.error('No transcripts to process.');
    process.exit(1);
  }
  print.emptyLine();
  return items;
}

// =============================================================================
// Run transcript pipeline
// =============================================================================
async function runTranscriptPipeline(): Promise<TailItem[]> {
  // ===========================================================================
  // Get RSS feed
  // ===========================================================================
  print.info('Fetching RSS feed...');
  const feed = await getAllRssItems(RSS_FEED_URL, opts.forceRss);
  if (feed.status === 'failed') {
    printLog.error(`Failed to fetch RSS feed <${RSS_FEED_URL}>`);
    process.exit(1);
  }
  printLog.info(`RSS feed: ${feed.items.length} items (${pc.blue(feed.status)})`);

  // ===========================================================================
  // Make episode metadata
  // ===========================================================================
  const episodes = findEpisodes(feed.items, opts.episodeNums);
  const foundEpisodeNums = episodes.map((e) => e.episodeNumber);
  if (episodes.length < opts.episodeNums.size) {
    if (episodes.length === 0) {
      printLog.error('No episodes found');
      process.exit(1);
    }
    const missingEpisodeNums = [...opts.episodeNums].filter((num) => !foundEpisodeNums.includes(num));
    printLog.warn(
      `${pluralize(missingEpisodeNums.length, 'Episode')} NOT found: ${missingEpisodeNums.map((num) => pc.red(num)).join(', ')}`,
    );
  } else {
    printLog.info(
      `Found all requested ${pluralize(foundEpisodeNums.length, 'episode')}: ${foundEpisodeNums.join(', ')}`,
    );
  }

  for (const episode of episodes) {
    const filepath = saveMetadata(episode);
    printLog.info([
      `#${episode.episodeNumber}: Saved "${toRelative(filepath)}"`,
      `  Title:        "${episode.title}"`,
      `  Publish date: ${formatDate(episode.pubDate)}`,
    ]);
  }
  print.emptyLine();

  // ===========================================================================
  // Make transcription requests
  // ===========================================================================
  print.info('Preparing for transcription...');
  let toTranscribes: ToTranscribe[] = [];
  for (const episode of episodes) {
    const toTranscribe = await makeToTranscribe(episode, opts.forceTranscribe);
    if (!toTranscribe) {
      printLog.warn(`#${episode.episodeNumber}: Skipping - transcript already exists`);
      continue;
    }

    if (toTranscribe.prompt.isOverLimit) {
      printLog.warn([
        `#${toTranscribe.episodeNumber}: Prompt token count ${toTranscribe.prompt.tokenCount}/${PROMPT_TOKEN_LIMIT}`,
        '  Prompt token count exceeds limit - PROMPT MAY BE TRUNCATED!',
      ]);
    } else {
      printLog.info(
        `#${toTranscribe.episodeNumber}: Prompt token count ${toTranscribe.prompt.tokenCount}/${PROMPT_TOKEN_LIMIT}`,
      );
    }

    toTranscribes.push(toTranscribe);
  }

  if (toTranscribes.length === 0) {
    printLog.info('No episodes to transcribe.');
    process.exit(0);
  }
  print.emptyLine();

  // ===========================================================================
  // Download MP3s
  // ===========================================================================
  print.info('Downloading MP3s...');
  for (const toTranscribe of toTranscribes) {
    const mp3 = await downloadMp3(toTranscribe, opts.forceDownload);
    if (mp3.status === 'failed') {
      toTranscribes = toTranscribes.filter((t) => t !== toTranscribe);
      print.warn(`#${toTranscribe.episodeNumber}: Failed ${mp3.error ? ` - ${mp3.error}` : ''}`);
    } else {
      const episodeNumber = toTranscribe.episodeNumber;
      const action = mp3.status === 'downloaded' ? 'Downloaded' : 'Already downloaded';
      const path = toTranscribe.mp3.path;
      const duration = toTranscribe.mp3.audioDuration.timestamp;
      const sizeMB = mp3.sizeMB;
      printLog.info(`#${episodeNumber}: ${action} "${path}" (${duration}, ${sizeMB} MB)`);
    }
  }

  if (toTranscribes.length === 0) {
    printLog.error('No MP3s could be downloaded to transcribe.');
    process.exit(1);
  }
  print.emptyLine();

  // ===========================================================================
  // Run VAD (index audio gaps)
  // ===========================================================================
  print.info('Running VAD...');
  for (const toTranscribe of toTranscribes) {
    const res = await runVad(toTranscribe.episodeNumber, toTranscribe.mp3.path, opts.forceVad);
    if (!res.ok) {
      toTranscribes = toTranscribes.filter((t) => t !== toTranscribe);
      printLog.warn(`#${toTranscribe.episodeNumber}: Failed${res.error ? ` - ${res.error}` : ''}`);
    } else if (res.status === 'alreadyExists') {
      printLog.warn(`#${toTranscribe.episodeNumber}: Skipping - VAD file already exists`);
    } else {
      printLog.info(`#${toTranscribe.episodeNumber}: Saved "${toRelative(res.path)}"`);
    }
  }

  if (toTranscribes.length === 0) {
    printLog.error('VAD failed for all episodes.');
    process.exit(1);
  }
  print.emptyLine();

  // ===========================================================================
  // Transcribe
  // ===========================================================================
  print.info('Transcribing...');
  const transcripts: Transcript[] = [];
  for (const toTranscribe of toTranscribes) {
    const res = await promptTranscript(toTranscribe, opts.transcribeModel);
    if (res.ok) {
      const { audioDuration, workDuration } = res.stats;
      const workPercentage = Math.round((workDuration.seconds / audioDuration.seconds) * 100);
      printLog.info([
        `#${toTranscribe.episodeNumber}: Saved "${toRelative(res.path)}"`,
        `  Work time:  ${workDuration.human} (${workPercentage}% of ${audioDuration.timestamp})`,
        `  Words:      ${formatNumber(res.stats.words)}`,
        `  Characters: ${formatNumber(res.stats.characters)}`,
      ]);
      transcripts.push(res);
    } else {
      printLog.warn(`#${toTranscribe.episodeNumber}: Failed ${res.error ? ` - ${res.error}` : ''}`);
    }
  }

  if (transcripts.length === 0) {
    printLog.error('No transcripts generated.');
    process.exit(1);
  }
  print.emptyLine();

  return transcripts.map((t) => ({
    episodeNumber: t.episodeNumber,
    path: t.path,
    title: t.title,
    description: t.description,
  }));
}

// =============================================================================
// Build paragraphs and paragraph groups
// =============================================================================
if (runParagraph) {
  print.info('Building paragraphs...');
  for (const item of tailItems) {
    const res = writeParagraphs(item);
    if (!res.ok) {
      printLog.warn(
        `#${item.episodeNumber}: Failed ${res.error ? `- ${res.error}` : ''}`,
      );
      continue;
    }
    printLog.info([
      `#${item.episodeNumber}: Saved "${toRelative(res.path)}"`,
      `  Paragraphs: ${formatNumber(res.stats.paragraphs)}`,
    ]);
  }
  print.emptyLine();

  print.info('Building paragraph groups...');
  for (const item of tailItems) {
    const res = writeParagraphGroups(item);
    if (!res.ok) {
      printLog.warn(
        `#${item.episodeNumber}: Failed ${res.error ? `- ${res.error}` : ''}`,
      );
      continue;
    }
    printLog.info([
      `#${item.episodeNumber}: Saved "${toRelative(res.path)}"`,
      `  Groups: ${formatNumber(res.stats.groups)}`,
    ]);
  }
  print.emptyLine();
}

// =============================================================================
// Summarize
// =============================================================================
if (runSummary) {
  print.info('Summarizing...');
  const summaries: Summary[] = [];
  for (const item of tailItems) {
    const res = await promptSummary(item, opts.summaryModel);
    if (!res.ok) {
      printLog.warn(
        `#${item.episodeNumber}: Failed ${res.error ? `- ${res.error}` : ''}`
      );
      continue;
    }
    printLog.info([
      `#${item.episodeNumber}: Saved "${toRelative(res.path)}"`,
      `  Tokens: input ${formatNumber(res.stats.tokenInput)} / output ${formatNumber(res.stats.tokenOutput)}`,
    ]);
    summaries.push(res);
  }

  if (summaries.length === 0) {
    printLog.error('No summaries generated.');
    process.exit(1);
  }
  print.emptyLine();
}
