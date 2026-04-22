import pc from 'picocolors';
import { getTranscribeCliArgs } from '@lib/transcribe-episodes/cli.js';
import { getAllRssItems } from '@lib/shared/rss.js';
import { findEpisodes } from '@lib/transcribe-episodes/episode.js';
import { downloadMp3 } from '@lib/transcribe-episodes/mp3.js';
import { runVad } from '@lib/transcribe-episodes/audioVad.js';
import { runFade } from '@lib/transcribe-episodes/audioFade.js';
import {
  makeToTranscribe, promptTranscript, PROMPT_TOKEN_LIMIT,
  type ToTranscribe, type Transcript, type TailItem,
} from '@lib/transcribe-episodes/transcript.js';
import { buildParagraphs } from '@lib/transcribe-episodes/paragraph.js';
import { buildParagraphGroups } from '@lib/transcribe-episodes/paragraphGroup.js';
import { promptSummary, type Summary } from '@lib/transcribe-episodes/summary.js';
import {
  paths, hasMetadata, readMetadata, writeMetadata,
  hasTranscript, hasFade, hasMp3, writeParagraph,
} from '@lib/shared/artifacts.js';
import { formatDate, formatNumber, pluralize } from '@lib/shared/strings.js';
import { toRelative } from '@lib/shared/paths.js';
import { print, printLog } from '@lib/shared/print.js';
import { RSS_FEED_URL } from '@lib/config/rss.js';

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
    if (!hasTranscript(episodeNumber)) {
      printLog.warn(`#${episodeNumber}: No transcript found - skipping`);
      continue;
    }

    let title = '';
    let description = '';
    if (runSummary) {
      if (!hasMetadata(episodeNumber)) {
        printLog.warn(`#${episodeNumber}: No metadata found - skipping`);
        continue;
      }
      ({ title, description } = readMetadata(episodeNumber));
    }

    items.push({ episodeNumber, title, description });
    printLog.info(`#${episodeNumber}: Loaded "${toRelative(paths(episodeNumber).transcript)}"`);
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
    const filepath = writeMetadata(episode.episodeNumber, {
      ...episode,
      pubDate: episode.pubDate.toISOString(),
    });
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
    const mp3 = await downloadMp3(
      toTranscribe.mp3.url,
      toTranscribe.mp3.path,
      opts.forceDownload,
    );
    if (mp3.status === 'failed') {
      toTranscribes = toTranscribes.filter((t) => t !== toTranscribe);
      print.warn(`#${toTranscribe.episodeNumber}: Failed ${mp3.error ? `- ${mp3.error}` : ''}`);
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
      printLog.warn(`#${toTranscribe.episodeNumber}: Failed ${res.error ? `- ${res.error}` : ''}`);
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
      printLog.warn(`#${toTranscribe.episodeNumber}: Failed ${res.error ? `- ${res.error}` : ''}`);
    }
  }

  if (transcripts.length === 0) {
    printLog.error('No transcripts generated.');
    process.exit(1);
  }
  print.emptyLine();

  return transcripts.map((t) => ({
    episodeNumber: t.episodeNumber,
    title: t.title,
    description: t.description,
  }));
}

// =============================================================================
// Build paragraphs and paragraph groups
// =============================================================================
if (runParagraph) {
  print.info('Building paragraph sidecars...');
  for (const item of tailItems) {
    const paragraphsRes = buildParagraphs(item);
    if (!paragraphsRes.ok) {
      printLog.warn(
        `#${item.episodeNumber}: Failed ${paragraphsRes.error ? `- ${paragraphsRes.error}` : ''}`,
      );
      continue;
    }
    const { paragraphs } = paragraphsRes;
    printLog.info(`#${item.episodeNumber}: Built ${formatNumber(paragraphsRes.stats.paragraphs)} paragraphs`);

    const needsFade = opts.forceFade || !hasFade(item.episodeNumber);

    if (needsFade) {
      const mp3Path = paths(item.episodeNumber).mp3;

      if (!hasMp3(item.episodeNumber)) {
        const { mp3Url } = readMetadata(item.episodeNumber);
        const mp3 = await downloadMp3(mp3Url, mp3Path, false);
        if (mp3.status === 'failed') {
          printLog.warn(
            `#${item.episodeNumber}: MP3 download failed ${mp3.error ? `- ${mp3.error}` : ''}`,
          );
          continue;
        }
        printLog.info(`#${item.episodeNumber}: Downloaded "${mp3Path}" (${mp3.sizeMB} MB)`);
      }

      const fadeRes = await runFade(item.episodeNumber, mp3Path, opts.forceFade);
      if (!fadeRes.ok) {
        printLog.warn(`#${item.episodeNumber}: Failed ${fadeRes.error ? `- ${fadeRes.error}` : ''}`);
        continue;
      } else if (fadeRes.status === 'alreadyExists') {
        printLog.warn(`#${item.episodeNumber}: Skipping - fade file already exists`);
      } else {
        printLog.info(`#${item.episodeNumber}: Saved "${toRelative(fadeRes.path)}"`);
      }
    } else {
      printLog.warn(`#${item.episodeNumber}: Skipping - fade file already exists`);
    }

    const groupsRes = buildParagraphGroups(item.episodeNumber, paragraphs);
    if (!groupsRes.ok) {
      printLog.warn(
        `#${item.episodeNumber}: Failed ${groupsRes.error ? `- ${groupsRes.error}` : ''}`,
      );
      continue;
    }

    const path = writeParagraph(item.episodeNumber, {
      segments: paragraphs,
      fadePairStarts: groupsRes.fadePairStarts,
    });
    printLog.info([
      `#${item.episodeNumber}: Saved "${toRelative(path)}"`,
      `  Paragraphs: ${formatNumber(paragraphs.length)}`,
      `  Groups:     ${formatNumber(groupsRes.stats.groups)}`,
      `  Fades:      ${formatNumber(groupsRes.stats.fades)}`,
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
