import { resolve, join, basename } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import minimist from 'minimist';
import pc from 'picocolors';
import { pluralize, handelize, formatDate, formatNumber, formatEpisodeNumber } from '@lib/strings.js';
import { fromSeconds } from '@lib/duration.js';
import { fetchEpisodes, findEpisodes, type Episode } from '@lib/transcribe/rss.js';
import { downloadMp3 } from '@lib/transcribe/download.js';
import { transcribe } from '@lib/transcribe/whisper.js';
import { computeTranscriptionStats, type Transcription } from '@lib/transcribe/stats.js';
import { summarizeEpisode } from '@lib/summarize/summarizeEpisode.js';
import { createLogger } from '@lib/logger.js';

const DEFAULT_MODEL = 'base';
const OUTPUT_DIR = resolve(import.meta.dirname, '../transcriptions');

const argv = minimist(process.argv.slice(2), {
  string: ['model', 'summary-model'],
  boolean: ['force', 'summarize'],
  default: { model: DEFAULT_MODEL, 'summary-model': 'gpt-4o', force: false, summarize: false },
});

const episodeNumbers = argv._.map(Number).filter((n) => !isNaN(n));
if (episodeNumbers.length === 0) {
  console.error('Usage: pnpm transcribe <episode-numbers...> [--model base] [--force] [--summarize] [--summary-model gpt-4o]');
  process.exit(1);
}

main();

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const log = createLogger();

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
    const num = formatEpisodeNumber(ep.episodeNumber);
    const transcriptionPath = join(OUTPUT_DIR, `${num}.transcription__${argv.model}.json`);
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
    log.info(`#${ep.episodeNumber} [${formatDate(ep.pubDate)}] "${ep.title}"`);

    // Write metadata sidecar
    const num = formatEpisodeNumber(ep.episodeNumber);
    const metaPath = join(OUTPUT_DIR, `${num}.episode-meta.json`);
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
    log.info(`  Length: "${ep.duration}"`);
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
    log.info(`#${episode.episodeNumber} [${episode.pubDate.toISOString().slice(0, 10)}] "${episode.title}"`);

    const num = formatEpisodeNumber(episode.episodeNumber);

    try {
      const result = await transcribe(mp3Path, OUTPUT_DIR, episode.durationSeconds, num, {
        model: argv.model,
        title: episode.title,
        description: episode.description,
      });
      // Compute and write transcription stats
      const raw = readFileSync(result.outputPath, 'utf-8');
      const transcription = JSON.parse(raw) as Transcription;
      const stats = computeTranscriptionStats(transcription);
      const statsPath = join(OUTPUT_DIR, `${num}.transcription__${argv.model}.stats.json`);
      writeFileSync(statsPath, JSON.stringify(stats, null, 2) + '\n');
      log.info(`  Stats: ${formatNumber(stats.wordCount)} words, ${formatNumber(stats.characterCount)} chars, confidence: ${stats.meanAvgLogProb.toFixed(3)}`);

      results.push({ episode, ...result });
      log.info(`  Output: "${basename(result.outputPath)}"`);
    } catch (err) {
      const msg = (err as Error).message;
      log.error(`  Transcription failed: ${msg}`);
      transcribeFailures.push({ episode, error: msg });
    }
  }

  // Phase 3: Summarize transcriptions (optional)
  if (argv.summarize && results.length > 0) {
    log.info('');
    log.info(`=== Summarizing ${results.length} ${pluralize(results.length, 'episode')} ===`);

    const summaryModel = argv['summary-model'];
    for (const r of results) {
      const num = formatEpisodeNumber(r.episode.episodeNumber);
      const summaryPath = join(OUTPUT_DIR, `${num}.transcription__${argv.model}.summary__${handelize(summaryModel)}.json`);

      log.info('');
      log.info(`#${r.episode.episodeNumber} "${r.episode.title}"`);

      try {
        const { skipped } = await summarizeEpisode({
          transcriptionPath: r.outputPath,
          summaryPath,
          episodeNumber: r.episode.episodeNumber,
          title: r.episode.title,
          description: r.episode.description,
          summaryModel,
          force: argv.force,
          log: (msg) => log.info(`  ${msg}`),
        });

        if (skipped) {
          log.warn(`Skipping summary for episode ${r.episode.episodeNumber}: already exists (use --force)`);
        }
      } catch (err) {
        log.error(`  Summarization failed: ${(err as Error).message}`);
      }
    }
  }

  // Summary
  log.info('');
  log.info('=== Summary ===');

  for (const r of results) {
    const pct = Math.round((r.wallTimeSeconds / r.episode.durationSeconds) * 100);
    log.info(`#${r.episode.episodeNumber} [${formatDate(r.episode.pubDate)}] "${r.episode.title}"`);
    const wall = fromSeconds(r.wallTimeSeconds);
    const total = fromSeconds(r.episode.durationSeconds);
    log.info(`  Transcription time:  ${wall.human} (${pct}% of ${total.timestamp})`);
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
}


