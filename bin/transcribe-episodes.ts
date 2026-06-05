import pc from 'picocolors';
import { getTranscribeCliArgs } from '#lib/transcribe-episodes/cli.ts';
import { findEpisodes } from '#lib/transcribe-episodes/episode.ts';
import { downloadMp3 } from '#lib/transcribe-episodes/mp3.ts';
import { detectGaps } from '#lib/transcribe-episodes/audioGaps.ts';
import { runFade } from '#lib/transcribe-episodes/audioFade.ts';
import {
  makeToTranscribe, promptTranscript, PROMPT_TOKEN_LIMIT,
  type ToTranscribe, type Transcript,
} from '#lib/transcribe-episodes/transcript.ts';
import { buildParagraphs } from '#lib/transcribe-episodes/paragraph.ts';
import {
  paths, hasRss, readRss, writeRss, hasMp3, hasGaps, hasFade,
  hasTranscript, readTranscript, writeTranscript,
} from '#lib/shared/artifacts.ts';
import type { ParagraphSegment } from '#lib/shared/schemas.ts';
import { formatDate, formatNumber, pluralize } from '#lib/shared/strings.ts';
import { toRelative } from '#lib/shared/paths.ts';
import { print, printLog } from '#lib/shared/print.ts';
import { getAllRssItems } from '#lib/shared/rss.ts';
import { RSS_FEED_URL } from '#lib/config/rss.ts';

// =============================================================================
// Main
// =============================================================================
const cli = getTranscribeCliArgs(process.argv);

const modeLabel = cli.runTranscript ? 'full pipeline' : 'paragraph only';
const banner = [
  `Transcribe ${pluralize(cli.episodeNums.size, 'episode')} (${modeLabel}): ${[...cli.episodeNums].join(', ')}`,
];
if (cli.runTranscript) banner.push(`  Whisper model: ${cli.transcribeModel}`);
printLog.info(banner);
print.emptyLine();

/**
 * Segments keyed by episode number, the single source of truth for which
 * episodes the paragraph stage processes. The transcribe path fills it with
 * freshly merged Whisper segments; `--only-paragraphs` fills it by flattening
 * the existing on-disk transcript. The paragraph stage iterates this map
 * directly.
 */
const segmentsByEpisode = new Map<number, ParagraphSegment[]>();

if (cli.runTranscript) await transcribeFromFeed();
else loadFromDisk();

if (cli.runParagraph) await buildTranscripts();

// =============================================================================
// Functions
// =============================================================================
/**
 * Fill `segmentsByEpisode` via the full pipeline: feed, MP3s, gaps, Whisper.
 */
async function transcribeFromFeed(): Promise<void> {
  // Get RSS feed --------------------------------------------------------------
  print.info('Fetching RSS feed...');
  const feed = await getAllRssItems(RSS_FEED_URL, cli.forceRss);
  if (feed.status === 'failed') {
    printLog.error(`Failed to fetch RSS feed <${RSS_FEED_URL}>`);
    process.exit(1);
  }
  printLog.info(`RSS feed: ${feed.items.length} items (${pc.blue(feed.status)})`);

  // Write episode RSS sidecar file(s)------------------------------------------
  const episodes = findEpisodes(feed.items, cli.episodeNums);
  const foundEpisodeNums = episodes.map((e) => e.episodeNumber);
  if (episodes.length < cli.episodeNums.size) {
    if (episodes.length === 0) {
      printLog.error('No episodes found');
      process.exit(1);
    }
    const missingEpisodeNums = [...cli.episodeNums].filter((num) => !foundEpisodeNums.includes(num));
    printLog.warn(
      `${pluralize(missingEpisodeNums.length, 'Episode')} NOT found: ${missingEpisodeNums.map((num) => pc.red(num)).join(', ')}`,
    );
  } else {
    printLog.info(
      `Found all requested ${pluralize(foundEpisodeNums.length, 'episode')}: ${foundEpisodeNums.join(', ')}`,
    );
  }

  for (const episode of episodes) {
    const filepath = writeRss(episode.episodeNumber, {
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

  // Make transcription requests -----------------------------------------------
  print.info('Preparing for transcription...');
  let toTranscribes: ToTranscribe[] = [];
  for (const episode of episodes) {
    const toTranscribe = await makeToTranscribe(episode, cli.forceTranscribe);
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

  // Download MP3s -------------------------------------------------------------
  print.info('Downloading MP3s...');
  for (const toTranscribe of toTranscribes) {
    const mp3 = await downloadMp3(
      toTranscribe.mp3.url,
      toTranscribe.mp3.path,
      cli.forceDownload,
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

  // Detect audio gaps and save (for transcribing and building paragraphs) -----
  print.info('Detecting audio gaps...');
  for (const toTranscribe of toTranscribes) {
    const res = await detectGaps(toTranscribe.episodeNumber, toTranscribe.mp3.path, cli.forceGaps);
    if (!res.ok) {
      toTranscribes = toTranscribes.filter((t) => t !== toTranscribe);
      printLog.warn(`#${toTranscribe.episodeNumber}: Failed ${res.error ? `- ${res.error}` : ''}`);
    } else if (res.status === 'alreadyExists') {
      printLog.warn(`#${toTranscribe.episodeNumber}: Skipping - gaps file already exists`);
    } else {
      printLog.info(`#${toTranscribe.episodeNumber}: Saved "${toRelative(res.path)}"`);
    }
  }

  if (toTranscribes.length === 0) {
    printLog.error('Gap detection failed for all episodes.');
    process.exit(1);
  }
  print.emptyLine();

  // Transcribe ----------------------------------------------------------------
  print.info('Transcribing...');
  const transcripts: Transcript[] = [];
  for (const toTranscribe of toTranscribes) {
    const res = await promptTranscript(toTranscribe, cli.transcribeModel);
    if (res.ok) {
      const { audioDuration, workDuration } = res.stats;
      const workPercentage = Math.round((workDuration.seconds / audioDuration.seconds) * 100);
      printLog.info([
        `#${toTranscribe.episodeNumber}: Transcribed`,
        `  Work time:  ${workDuration.human} (${workPercentage}% of ${audioDuration.timestamp})`,
        `  Words:      ${formatNumber(res.stats.words)}`,
        `  Characters: ${formatNumber(res.stats.characters)}`,
      ]);
      segmentsByEpisode.set(res.episodeNumber, res.segments);
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
}

/**
 * Fill `segmentsByEpisode` from on-disk transcripts (`--only-paragraphs`).
 */
function loadFromDisk(): void {
  print.info('Loading existing transcripts...');
  for (const episodeNumber of cli.episodeNums) {
    if (!hasTranscript(episodeNumber)) {
      printLog.warn(`#${episodeNumber}: No transcript found - skipping`);
      continue;
    }
    if (!hasRss(episodeNumber)) {
      printLog.warn(`#${episodeNumber}: No RSS data found - skipping`);
      continue;
    }

    segmentsByEpisode.set(episodeNumber, readTranscript(episodeNumber).paragraphGroups.flat(2));
    printLog.info(`#${episodeNumber}: Loaded "${toRelative(paths(episodeNumber).transcript)}"`);
  }

  if (segmentsByEpisode.size === 0) {
    printLog.error('No transcripts to process.');
    process.exit(1);
  }
  print.emptyLine();
}

/**
 * Build paragraphs and paragraph groups.
 */
async function buildTranscripts(): Promise<void> {
  print.info('Building transcripts...');
  for (const [episodeNumber, segments] of segmentsByEpisode) {
    if (!hasGaps(episodeNumber)) {
      printLog.warn(`#${episodeNumber}: No gaps file - skipping`);
      continue;
    }

    const needsFade = cli.forceFade || !hasFade(episodeNumber);

    if (needsFade) {
      const mp3Path = paths(episodeNumber).mp3;

      if (!hasMp3(episodeNumber)) {
        const { mp3Url } = readRss(episodeNumber);
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

    const paragraphsRes = buildParagraphs(episodeNumber, segments);
    if (!paragraphsRes.ok) {
      printLog.warn(
        `#${episodeNumber}: Failed ${paragraphsRes.error ? `- ${paragraphsRes.error}` : ''}`,
      );
      continue;
    }
    const { paragraphGroups, stats } = paragraphsRes;

    const path = writeTranscript(episodeNumber, { paragraphGroups });
    printLog.info([
      `#${episodeNumber}: Saved "${toRelative(path)}"`,
      `  Paragraphs: ${formatNumber(stats.paragraphs)}`,
      `  Groups:     ${formatNumber(stats.paragraphGroups)}`,
      `  Fades:      ${formatNumber(stats.fades)}`,
    ]);
  }
  print.emptyLine();
}
