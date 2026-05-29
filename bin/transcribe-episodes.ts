import pc from 'picocolors';
import { getTranscribeCliArgs } from '@lib/transcribe-episodes/cli.js';
import { getAllRssItems } from '@lib/shared/rss.js';
import { findEpisodes } from '@lib/transcribe-episodes/episode.js';
import { downloadMp3 } from '@lib/transcribe-episodes/mp3.js';
import { runVad } from '@lib/transcribe-episodes/audioVad.js';
import { runFade } from '@lib/transcribe-episodes/audioFade.js';
import {
  makeToTranscribe, promptTranscript, PROMPT_TOKEN_LIMIT,
  type ToTranscribe, type Transcript,
} from '@lib/transcribe-episodes/transcript.js';
import { buildParagraphs } from '@lib/transcribe-episodes/paragraph.js';
import { buildMarkdown } from '@lib/transcribe-episodes/markdown.js';
import {
  paths, hasMetadata, readMetadata, writeMetadata,
  hasTranscript, hasVad, hasFade, hasMp3,
  hasParagraph, readParagraph, writeParagraph, writeMarkdown,
} from '@lib/shared/artifacts.js';
import { formatDate, formatNumber, pluralize } from '@lib/shared/strings.js';
import { toRelative } from '@lib/shared/paths.js';
import { print, printLog } from '@lib/shared/print.js';
import { RSS_FEED_URL } from '@lib/config/rss.js';

// =============================================================================
// Parse CLI args
// =============================================================================
const opts = getTranscribeCliArgs(process.argv);
const { runTranscript, runParagraph, runMarkdown } = opts.runPipeline;

let modeLabel: string;
if (runTranscript) modeLabel = 'full pipeline';
else if (runParagraph) modeLabel = 'paragraph only';
else modeLabel = 'markdown only';

const banner = [
  `Transcribe ${pluralize(opts.episodeNums.size, 'episode')} (${modeLabel}): ${[...opts.episodeNums].join(', ')}`,
];
if (runTranscript) banner.push(`  Whisper model: ${opts.transcribeModel}`);
printLog.info(banner);
print.emptyLine();

let episodeNumbers: number[];
if (runTranscript) episodeNumbers = await runTranscriptPipeline();
else if (runParagraph) episodeNumbers = loadFromDisk('transcript');
else episodeNumbers = loadFromDisk('paragraph');

// =============================================================================
// Load existing artifacts from disk
// =============================================================================
function loadFromDisk(requires: 'transcript' | 'paragraph'): number[] {
  const artifact = requires === 'transcript' ? 'transcripts' : 'paragraph sidecars';
  print.info(`Loading existing ${artifact}...`);
  const items: number[] = [];
  for (const episodeNumber of opts.episodeNums) {
    const has = requires === 'transcript' ? hasTranscript(episodeNumber) : hasParagraph(episodeNumber);
    if (!has) {
      printLog.warn(`#${episodeNumber}: No ${requires} found - skipping`);
      continue;
    }
    if (!hasMetadata(episodeNumber)) {
      printLog.warn(`#${episodeNumber}: No metadata found - skipping`);
      continue;
    }

    items.push(episodeNumber);
    const path = requires === 'transcript' ? paths(episodeNumber).transcript : paths(episodeNumber).paragraph;
    printLog.info(`#${episodeNumber}: Loaded "${toRelative(path)}"`);
  }

  if (items.length === 0) {
    printLog.error(`No ${artifact} to process.`);
    process.exit(1);
  }
  print.emptyLine();
  return items;
}

// =============================================================================
// Run transcript pipeline
// =============================================================================
async function runTranscriptPipeline(): Promise<number[]> {
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

  return transcripts.map((t) => t.episodeNumber);
}

// =============================================================================
// Build paragraphs and paragraph groups
// =============================================================================
if (runParagraph) {
  print.info('Building paragraph sidecars...');
  for (const episodeNumber of episodeNumbers) {
    if (!hasVad(episodeNumber)) {
      printLog.warn(`#${episodeNumber}: No VAD file - skipping`);
      continue;
    }

    const needsFade = opts.forceFade || !hasFade(episodeNumber);

    if (needsFade) {
      const mp3Path = paths(episodeNumber).mp3;

      if (!hasMp3(episodeNumber)) {
        const { mp3Url } = readMetadata(episodeNumber);
        const mp3 = await downloadMp3(mp3Url, mp3Path, false);
        if (mp3.status === 'failed') {
          printLog.warn(
            `#${episodeNumber}: MP3 download failed ${mp3.error ? `- ${mp3.error}` : ''}`,
          );
          continue;
        }
        printLog.info(`#${episodeNumber}: Downloaded "${mp3Path}" (${mp3.sizeMB} MB)`);
      }

      const fadeRes = await runFade(episodeNumber, mp3Path);
      if (fadeRes.ok) {
        printLog.info(`#${episodeNumber}: Saved "${toRelative(fadeRes.path)}"`);
      } else {
        printLog.warn(`#${episodeNumber}: Failed ${fadeRes.error ? `- ${fadeRes.error}` : ''}`);
        continue;
      }
    } else {
      printLog.warn(`#${episodeNumber}: Skipping - fade file already exists`);
    }

    const paragraphsRes = buildParagraphs(episodeNumber);
    if (!paragraphsRes.ok) {
      printLog.warn(
        `#${episodeNumber}: Failed ${paragraphsRes.error ? `- ${paragraphsRes.error}` : ''}`,
      );
      continue;
    }
    const { paragraphs, fadePairStarts, stats } = paragraphsRes;

    const path = writeParagraph(episodeNumber, {
      segments: paragraphs,
      fadePairStarts,
    });
    printLog.info([
      `#${episodeNumber}: Saved "${toRelative(path)}"`,
      `  Paragraphs: ${formatNumber(stats.paragraphs)}`,
      `  Groups:     ${formatNumber(stats.paragraphGroups)}`,
      `  Fades:      ${formatNumber(stats.fades)}`,
    ]);
  }
  print.emptyLine();
}

// =============================================================================
// Build Markdown transcripts
// =============================================================================
if (runMarkdown) {
  print.info('Building Markdown transcripts...');
  for (const episodeNumber of episodeNumbers) {
    if (!hasParagraph(episodeNumber)) {
      printLog.warn(`#${episodeNumber}: No paragraph sidecar - skipping`);
      continue;
    }
    const { segments, fadePairStarts } = readParagraph(episodeNumber);
    const markdown = buildMarkdown(readMetadata(episodeNumber), segments, fadePairStarts);
    const markdownPath = writeMarkdown(episodeNumber, markdown);
    printLog.info(`#${episodeNumber}: Saved "${toRelative(markdownPath)}"`);
  }
  print.emptyLine();
}
