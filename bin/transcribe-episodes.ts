import pc from 'picocolors';
import { getTranscribeCliArgs } from '@lib/transcribe-episodes/cli.js';
import { getAllRssItems } from '@lib/shared/rss.js';
import { findEpisodes, saveMetadata } from '@lib/transcribe-episodes/episode.js';
import { downloadMp3 } from '@lib/transcribe-episodes/mp3.js';
import {
  makeToTranscribe, promptTranscript, PROMPT_TOKEN_LIMIT,
  type ToTranscribe, type Transcript,
} from '@lib/transcribe-episodes/transcript.js';
import { promptSummary, type Summary } from '@lib/transcribe-episodes/summary.js';
import { toRelative } from '@lib/transcribe-episodes/paths.js';
import { formatDate, formatNumber, pluralize } from '@lib/shared/strings.js';
import { print, printAndLog } from '@lib/shared/print.js';
import { RSS_FEED_URL } from '@lib/config/podcast.js';

// =============================================================================
// Parse CLI args
// =============================================================================
const opts = getTranscribeCliArgs(process.argv);
printAndLog.info([
  `Transcribe ${pluralize(opts.episodeNums.size, 'episode')}: ${[...opts.episodeNums].join(', ')}`,
  `  Whisper model: ${opts.transcribeModel}`,
  `  Summary model: ${opts.summaryModel}`,
]);
print.emptyLine();

// =============================================================================
// Get RSS feed
// =============================================================================
print.info('Fetching RSS feed...');
const feed = await getAllRssItems(RSS_FEED_URL, opts.forceRss);
if (feed.status === 'failed') {
  printAndLog.error(`Failed to fetch RSS feed <${RSS_FEED_URL}>`);
  process.exit(1);
}
printAndLog.info(`RSS feed: ${feed.items.length} items (${pc.blue(feed.status)})`);

// =============================================================================
// Make episode metadata
// =============================================================================
const episodes = findEpisodes(feed.items, opts.episodeNums);
const foundEpisodeNums = episodes.map(e => e.episodeNumber);
if (episodes.length < opts.episodeNums.size) {
  if (episodes.length === 0) {
    printAndLog.error('No episodes found');
    process.exit(1);
  } else {
    const missingEpisodeNums = [...opts.episodeNums].filter(num => !foundEpisodeNums.includes(num));
    printAndLog.warn(
      `${pluralize(missingEpisodeNums.length, 'Episode')} NOT found: ${missingEpisodeNums.map(num => pc.red(num)).join(', ')}`
    );
  }
} else {
  printAndLog.info(
    `Found all requested ${pluralize(foundEpisodeNums.length, 'episode')}: ${foundEpisodeNums.join(', ')}`
  );
}

for (const episode of episodes) {
  const filepath = saveMetadata(episode);
  printAndLog.info([
    `#${episode.episodeNumber}: Saved "${toRelative(filepath)}"`,
    `  Title:        "${episode.title}"`,
    `  Publish date: ${formatDate(episode.pubDate)}`,
  ]);
}
print.emptyLine();

// =============================================================================
// Make transcription requests
// =============================================================================
print.info('Preparing for transcription...');
let toTranscribes: ToTranscribe[] = [];
for (const episode of episodes) {
  const toTranscribe = await makeToTranscribe(episode, opts.transcribeModel, opts.forceTranscribe);
  if (!toTranscribe) {
    printAndLog.warn(`#${episode.episodeNumber}: Skipping - transcript already exists`);
    continue;
  }

  if (toTranscribe.prompt.isOverLimit) {
    printAndLog.warn([
      `#${toTranscribe.episodeNumber}: Prompt token count ${toTranscribe.prompt.tokenCount}/${PROMPT_TOKEN_LIMIT}`,
      '  Prompt token count exceeds limit - PROMPT MAY BE TRUNCATED!',
    ]);
  } else {
    printAndLog.info(
      `#${toTranscribe.episodeNumber}: Prompt token count ${toTranscribe.prompt.tokenCount}/${PROMPT_TOKEN_LIMIT}`
    );
  }

  toTranscribes.push(toTranscribe);
}

if (toTranscribes.length === 0) {
  printAndLog.info('No episodes to transcribe.');
  process.exit(0);
}
print.emptyLine();

// =============================================================================
// Download MP3s
// =============================================================================
print.info('Downloading MP3s...');
for (const toTranscribe of toTranscribes) {
  const mp3 = await downloadMp3(toTranscribe, opts.forceDownload);
  if (mp3.status === 'failed') {
    // Remove from toTranscribes
    toTranscribes = toTranscribes.filter(t => t !== toTranscribe);
    print.warn(`#${toTranscribe.episodeNumber}: Failed ${mp3.error ? ` - ${mp3.error}` : ''}`);
  } else {
    const episodeNumber = toTranscribe.episodeNumber;
    const action = mp3.status === 'downloaded' ? 'Downloaded' : 'Already downloaded';
    const path = toTranscribe.mp3.path;
    const timestamp = toTranscribe.mp3.audioDuration.timestamp;
    const sizeMB = mp3.sizeMB;
    printAndLog.info(`#${episodeNumber}: ${action} "${path}" (${timestamp}, ${sizeMB} MB)`);
  }
}

if (toTranscribes.length === 0) {
  printAndLog.error('No MP3s could be downloaded to transcribe.');
  process.exit(1);
}
print.emptyLine();

// =============================================================================
// Transcribe
// =============================================================================
print.info('Transcribing...');
const transcripts: Transcript[] = [];
for (const toTranscribe of toTranscribes) {
  const res = await promptTranscript(toTranscribe, opts.transcribeModel);
  if (res.ok) {
    const { audioDuration, workDuration } = res.stats;
    const workPercentage = Math.round((workDuration.seconds / audioDuration.seconds) * 100);
    printAndLog.info([
      `#${toTranscribe.episodeNumber}: Saved "${toRelative(res.path)}"`,
      `  Work time:  ${workDuration.human} (${workPercentage}% of ${audioDuration.timestamp})`,
      `  Words:      ${formatNumber(res.stats.words)}`,
      `  Characters: ${formatNumber(res.stats.characters)}`,
    ]);
    transcripts.push(res);
  } else {
    printAndLog.warn(`#${toTranscribe.episodeNumber}: Failed ${res.error ? ` - ${res.error}` : ''}`);
  }
}

if (transcripts.length === 0) {
  printAndLog.error('No transcripts generated.');
  process.exit(1);
}
print.emptyLine();

// =============================================================================
// Summarize
// =============================================================================
print.info('Summarizing...');
const summaries: Summary[] = [];
for (const transcript of transcripts) {
  const res = await promptSummary(
    transcript,
    opts.summaryModel,
    opts.transcribeModel,
    opts.forceSummarize,
  );
  if (!res.ok) {
    printAndLog.warn(
      `#${transcript.episodeNumber}: Failed ${res.error ? ` - ${res.error}` : ''}`
    );
    continue;
  }
  if (res.status === 'alreadyExists') {
    printAndLog.warn(`#${res.episodeNumber}: Skipping - summary already exists`);
  } else {
    printAndLog.info([
      `#${transcript.episodeNumber}: Saved "${toRelative(res.path)}"`,
      `  Tokens: input ${formatNumber(res.stats.tokenInput)} / output ${formatNumber(res.stats.tokenOutput)}`,
    ]);
  }
  summaries.push(res);
}

if (summaries.length === 0) {
  printAndLog.error('No summaries generated.');
  process.exit(1);
}
print.emptyLine();
