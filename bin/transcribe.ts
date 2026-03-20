import { resolve, join, basename } from 'node:path';
import { existsSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import minimist from 'minimist';
import pc from 'picocolors';
import { pluralize } from '../lib/strings.js';
import { fetchEpisodes, findEpisodes, type Episode } from '../lib/transcribe/rss.js';
import { downloadMp3 } from '../lib/transcribe/download.js';
import { transcribe } from '../lib/transcribe/whisper.js';

const DEFAULT_MODEL = 'base';
const OUTPUT_DIR = resolve(import.meta.dirname, '../transcriptions');

const argv = minimist(process.argv.slice(2), {
  string: ['model'],
  boolean: ['force'],
  default: { model: DEFAULT_MODEL, force: false },
});

const episodeNumbers = argv._.map(Number).filter((n) => !isNaN(n));
if (episodeNumbers.length === 0) {
  console.error('Usage: pnpm transcribe <episode-numbers...> [--model base] [--force]');
  process.exit(1);
}

main();

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Set up log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const logPath = join(OUTPUT_DIR, `transcribe-${timestamp}.log`);
  const log = createLogger(logPath);

  log.info(`${pluralize(episodeNumbers.length, 'Episode')}: ${episodeNumbers.join(', ')}`);
  log.info(`Model: ${pc.blue(argv.model)}`);
  log.info('');

  // Fetch RSS feed
  log.info('Fetching RSS feed...');
  let allEpisodes;
  try {
    allEpisodes = await fetchEpisodes();
  } catch (err) {
    log.error(`Failed to fetch RSS feed: ${(err as Error).message}`);
    process.exit(1);
  }
  log.info(pc.green(`Found ${allEpisodes.length} episodes`));

  // Look up requested episodes
  const { found, notFound } = findEpisodes(episodeNumbers, allEpisodes);

  if (notFound.length > 0) {
    const range = allEpisodes.map((ep) => ep.episodeNumber);
    const min = Math.min(...range);
    const max = Math.max(...range);
    log.warn(`Episodes not found: ${notFound.join(', ')} (feed has episodes ${min}\u2013${max})`);
  }

  if (found.length === 0) {
    log.error('No valid episodes to process.');
    process.exit(1);
  }

  // Check for existing transcriptions
  const toProcess: Episode[] = [];
  for (const ep of found) {
    const stem = buildOutputStem(ep);
    const transcriptionPath = join(OUTPUT_DIR, `${stem}--${argv.model}.json`);
    if (existsSync(transcriptionPath) && !argv.force) {
      log.warn(`Skipping episode ${ep.episodeNumber}: ${basename(transcriptionPath)} already exists (use --force to overwrite)`);
    } else {
      toProcess.push(ep);
    }
  }

  if (toProcess.length === 0) {
    log.info('Nothing to do — all transcriptions already exist.');
    process.exit(0);
  }

  // Phase 1: Download all MP3s
  log.info('');
  log.info(`=== Downloading ${toProcess.length} ${pluralize(toProcess.length, 'episode')} ===`);

  const downloaded: { episode: Episode; mp3Path: string }[] = [];
  const downloadFailures: { episode: Episode; error: string }[] = [];

  for (const ep of toProcess) {
    log.info('');
    log.info(`#${ep.episodeNumber} [${formatDate(ep.pubDate)}] "${ep.title}" (${ep.duration})`);

    // Write metadata sidecar
    const stem = buildOutputStem(ep);
    const metaPath = join(OUTPUT_DIR, `${stem}.meta.json`);
    const metadata = {
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      pubDate: ep.pubDate.toISOString(),
      description: ep.description,
      duration: ep.duration,
      durationSeconds: ep.durationSeconds,
      imageUrl: ep.imageUrl,
      mp3Url: ep.mp3Url,
    };
    writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + '\n');
    log.info(`  Metadata: "${basename(metaPath)}"`);

    try {
      const mp3Path = await downloadMp3(ep.mp3Url, ep.episodeNumber);
      downloaded.push({ episode: ep, mp3Path });
    } catch (err) {
      const msg = (err as Error).message;
      log.error(`  Download failed: ${msg}`);
      downloadFailures.push({ episode: ep, error: msg });
    }
  }

  // Phase 2: Transcribe all downloaded MP3s
  log.info('');
  log.info(`=== Transcribing ${downloaded.length} ${pluralize(downloaded.length, 'episode')} ===`);

  const results: { episode: Episode; outputPath: string; wallTimeSeconds: number }[] = [];
  const transcribeFailures: { episode: Episode; error: string }[] = [];

  for (const { episode, mp3Path } of downloaded) {
    log.info('');
    log.info(`#${episode.episodeNumber} [${formatDate(episode.pubDate)}] "${episode.title}"`);

    const stem = buildOutputStem(episode);

    try {
      const result = await transcribe(mp3Path, OUTPUT_DIR, episode.durationSeconds, stem, {
        model: argv.model,
        title: episode.title,
        description: episode.description,
      });
      results.push({ episode, ...result });
      log.info(`  Output: "${basename(result.outputPath)}"`);
    } catch (err) {
      const msg = (err as Error).message;
      log.error(`  Transcription failed: ${msg}`);
      transcribeFailures.push({ episode, error: msg });
    }
  }

  // Summary
  log.info('');
  log.info('=== Summary ===');

  for (const r of results) {
    const wallTime = formatSeconds(r.wallTimeSeconds);
    log.info(`[${r.episode.episodeNumber}] ${r.episode.title}`);
    log.info(`  Episode duration:    ${r.episode.duration}`);
    log.info(`  Transcription time:  ${wallTime}`);
    log.info(`  Output:              "${basename(r.outputPath)}"`);
  }

  const allFailures = [
    ...notFound.map((n) => `  Episode ${n}: not found in feed`),
    ...downloadFailures.map((f) => `  Episode ${f.episode.episodeNumber}: download failed — ${f.error}`),
    ...transcribeFailures.map((f) => `  Episode ${f.episode.episodeNumber}: transcription failed — ${f.error}`),
  ];

  if (allFailures.length > 0) {
    log.info('');
    log.warn('Failures:');
    for (const f of allFailures) {
      log.warn(f);
    }
  }

  log.info('');
  log.info(`Log: ${logPath}`);
}

/**
 * Date → YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildOutputStem(ep: Episode): string {
  const num = String(ep.episodeNumber).padStart(4, '0');
  const date = formatDate(ep.pubDate);
  const safeTitle = ep.title.replace(/[/\\:*?"<>|]/g, '-');
  return `${num} [${date}] ${safeTitle}`;
}

function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function createLogger(logPath: string) {
  const write = (level: string, msg: string) => {
    const line = `${msg}`;
    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
    // Strip ANSI color codes before writing to log file
    appendFileSync(logPath, line.replace(/\x1b\[[0-9;]*m/g, '') + '\n');
  };

  return {
    info: (msg: string) => write('info', msg),
    warn: (msg: string) => write('warn', `[WARN] ${msg}`),
    error: (msg: string) => write('error', `[ERROR] ${msg}`),
  };
}
