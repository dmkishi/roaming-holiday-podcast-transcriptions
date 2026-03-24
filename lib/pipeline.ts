import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import pc from 'picocolors';
import { DEFAULT_WHISPER_MODEL, DEFAULT_SUMMARY_MODEL } from '@lib/config/models.js';
import { fromSeconds } from '@lib/duration.js';
import { createLogger } from '@lib/logger.js';
import { episodePaths, findTranscript, TRANSCRIPTS_DIR } from '@lib/paths.js';
import { pluralize, formatDate, formatNumber } from '@lib/strings.js';
import { downloadMp3 } from '@lib/transcribe/download.js';
import { fetchEpisodes, findEpisodes, type Episode } from '@lib/transcribe/rss.js';
import { transcribe } from '@lib/transcribe/whisper.js';
import { summarizeEpisode } from '@lib/summarize/summarizeEpisode.js';

// =============================================================================
// Types
// =============================================================================
export interface TranscribeOptions {
  episodes: number[];
  model?: string;
  force?: boolean;
  summarize?: boolean;
  summaryModel?: string;
}

export type EpisodeOutcome =
  | { status: 'skipped'; episode: number; reason: string }
  | { status: 'not_found'; episode: number }
  | { status: 'download_failed'; episode: number; error: string }
  | { status: 'transcribe_failed'; episode: number; error: string }
  | { status: 'summarize_failed'; episode: number; error: string }
  | {
      status: 'completed';
      episode: number;
      title: string;
      wallTimeSeconds: number;
      durationSeconds: number;
      outputPath: string;
      summarized: boolean;
    };

export interface TranscribeResult {
  outcomes: EpisodeOutcome[];
}

export interface SummarizeOptions {
  episodes: number[];
  model?: string;
  summaryModel?: string;
  force?: boolean;
}

export type SummarizeOutcome =
  | { status: 'no_transcript'; episode: number }
  | { status: 'skipped'; episode: number }
  | { status: 'failed'; episode: number; error: string }
  | { status: 'completed'; episode: number; result: { summary: string; places: string[]; keywords: string[]; } };

export interface SummarizeResult {
  outcomes: SummarizeOutcome[];
}

// =============================================================================
// Transcribe pipeline
// =============================================================================
export async function runTranscribePipeline(opts: TranscribeOptions): Promise<TranscribeResult> {
  const model = opts.model ?? DEFAULT_WHISPER_MODEL;
  const force = opts.force ?? false;
  const summaryModel = opts.summaryModel ?? DEFAULT_SUMMARY_MODEL;

  mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  const log = createLogger();

  log.info(`${pluralize(opts.episodes.length, 'Episode')}: ${opts.episodes.join(', ')}`);
  log.info(`Whisper Model: ${pc.blue(model)}`);
  log.info('');

  log.info('Fetching RSS feed...');
  let allEpisodes: Episode[];
  try {
    allEpisodes = await fetchEpisodes();
  } catch (err) {
    const msg = `Failed to fetch RSS feed: ${(err as Error).message}`;
    log.error(msg);
    log.record('error', msg);
    return { outcomes: opts.episodes.map((ep) => ({ status: 'not_found' as const, episode: ep })) };
  }
  log.info(pc.green(`Found ${allEpisodes.length} episodes`));
  log.record('info', `Fetched RSS feed (${allEpisodes.length} episodes)`);

  // Find requested episodes
  const { found, notFound } = findEpisodes(opts.episodes, allEpisodes);
  const outcomes: EpisodeOutcome[] = [];
  if (notFound.length > 0) {
    const range = allEpisodes.map((ep) => ep.episodeNumber);
    const min = Math.min(...range);
    const max = Math.max(...range);
    const msg = `Episodes not found: ${notFound.join(', ')} (feed has episodes ${min}-${max})`;
    log.warn(msg);
    log.record('warn', msg);
    for (const n of notFound) {
      outcomes.push({ status: 'not_found', episode: n });
    }
  }
  if (found.length === 0) {
    log.error('No valid episodes to process.');
    return { outcomes };
  }

  // Check for existing transcripts
  const toProcess: Episode[] = [];
  for (const ep of found) {
    if (!force && findTranscript(ep.episodeNumber, model)) {
      const paths = episodePaths({ episode: ep.episodeNumber, model });
      const msg = `Skipped episode ${ep.episodeNumber}: "${basename(paths.transcript)}" already exists`;
      log.warn(`${msg} (use --force to overwrite)`);
      log.record('warn', msg);
      outcomes.push({ status: 'skipped', episode: ep.episodeNumber, reason: 'transcript already exists' });
    } else {
      toProcess.push(ep);
    }
  }

  if (toProcess.length === 0) {
    log.info('Nothing to do — all transcripts already exist.');
    return { outcomes };
  }

  // Phase 1: Download all MP3s
  log.info('');
  log.info(`=== Downloading ${toProcess.length} ${pluralize(toProcess.length, 'episode')} ===`);

  const downloaded: { episode: Episode; mp3Path: string }[] = [];

  for (const ep of toProcess) {
    log.info('');
    log.info(`#${ep.episodeNumber} [${formatDate(ep.pubDate)}] "${ep.title}"`);

    // Write metadata sidecar
    const paths = episodePaths({ episode: ep.episodeNumber, model });
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
    writeFileSync(paths.rss, JSON.stringify(metadata, null, 2) + '\n');
    log.info(`  Length: ${ep.duration}`);
    log.info(`  Metadata: "${basename(paths.rss)}"`);
    log.record('info', `Saved RSS metadata: "${basename(paths.rss)}"`, {
      'Title': `"${ep.title}"`,
      'Publish Date': ep.pubDate.toISOString().slice(0, 10),
      'Length': ep.duration,
    });

    try {
      const mp3Path = await downloadMp3(ep.mp3Url, ep.episodeNumber);
      downloaded.push({ episode: ep, mp3Path });
    } catch (err) {
      const error = (err as Error).message;
      log.error(`  Download failed: ${error}`);
      log.record('error', `Download failed for episode ${ep.episodeNumber}: ${error}`);
      outcomes.push({ status: 'download_failed', episode: ep.episodeNumber, error });
    }
  }

  // Phase 2: Transcribe all downloaded MP3s
  log.info('');
  log.info(`=== Transcribing ${downloaded.length} ${pluralize(downloaded.length, 'episode')} ===`);

  const transcribed: { episode: Episode; outputPath: string; wallTimeSeconds: number }[] = [];

  for (const { episode, mp3Path } of downloaded) {
    log.info('');
    log.info(`#${episode.episodeNumber} [${episode.pubDate.toISOString().slice(0, 10)}] "${episode.title}"`);

    const paths = episodePaths({ episode: episode.episodeNumber, model });

    try {
      const result = await transcribe(mp3Path, paths.transcript, episode.durationSeconds, {
        model,
        title: episode.title,
        description: episode.description,
      });

      const text = readFileSync(result.outputPath, 'utf-8');
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const charCount = text.length;
      log.info(`  Stats: ${formatNumber(wordCount)} words, ${formatNumber(charCount)} chars`);

      transcribed.push({ episode, ...result });
      log.info(`  Output: "${basename(result.outputPath)}"`);

      const wall = fromSeconds(result.wallTimeSeconds);
      const total = fromSeconds(episode.durationSeconds);
      const pct = Math.round((result.wallTimeSeconds / episode.durationSeconds) * 100);
      log.record('info', `Saved transcription: "${basename(result.outputPath)}"`, {
        'Model': model,
        'Transcription time': `${wall.human} (${pct}% of ${total.timestamp})`,
        'Characters': formatNumber(charCount),
        'Words': formatNumber(wordCount),
      });
    } catch (err) {
      const error = (err as Error).message;
      log.error(`  Transcription failed: ${error}`);
      log.record('error', `Transcription failed for episode ${episode.episodeNumber}: ${error}`);
      outcomes.push({ status: 'transcribe_failed', episode: episode.episodeNumber, error });
    }
  }

  // Phase 3: Summarize transcripts (optional)
  const summarized = new Set<number>();

  if (opts.summarize && transcribed.length > 0) {
    log.info('');
    log.info(`=== Summarizing ${transcribed.length} ${pluralize(transcribed.length, 'episode')} ===`);

    for (const r of transcribed) {
      const paths = episodePaths({ episode: r.episode.episodeNumber, model, summaryModel });

      log.info('');
      log.info(`#${r.episode.episodeNumber} "${r.episode.title}"`);

      try {
        const { skipped, usage } = await summarizeEpisode({
          transcriptPath: r.outputPath,
          summaryPath: paths.summary!,
          title: r.episode.title,
          description: r.episode.description,
          summaryModel,
          force,
          log: (msg) => log.info(`  ${msg}`),
        });

        if (skipped) {
          log.warn(`Skipping summary for episode ${r.episode.episodeNumber}: already exists (use --force)`);
        } else {
          summarized.add(r.episode.episodeNumber);
          const details: Record<string, string> = { 'Model': summaryModel };
          if (usage) {
            details['Tokens'] = `input ${formatNumber(usage.prompt)} / output ${formatNumber(usage.completion)}`;
          }
          log.record('info', `Saved summary: "${basename(paths.summary!)}"`, details);
        }
      } catch (err) {
        log.error(`  Summarization failed: ${(err as Error).message}`);
        log.record('error', `Summarization failed for episode ${r.episode.episodeNumber}: ${(err as Error).message}`);
        outcomes.push({ status: 'summarize_failed', episode: r.episode.episodeNumber, error: (err as Error).message });
      }
    }
  }

  // Build completed outcomes
  for (const r of transcribed) {
    // Only add completed if not already marked as summarize_failed
    if (!outcomes.some((o) => o.episode === r.episode.episodeNumber && o.status === 'summarize_failed')) {
      outcomes.push({
        status: 'completed',
        episode: r.episode.episodeNumber,
        title: r.episode.title,
        wallTimeSeconds: r.wallTimeSeconds,
        durationSeconds: r.episode.durationSeconds,
        outputPath: r.outputPath,
        summarized: summarized.has(r.episode.episodeNumber),
      });
    }
  }

  // Print summary
  log.info('');
  log.info('=== Summary ===');

  const completed = outcomes.filter((o): o is Extract<EpisodeOutcome, { status: 'completed' }> => o.status === 'completed');
  for (const r of completed) {
    const pct = Math.round((r.wallTimeSeconds / r.durationSeconds) * 100);
    log.info(`#${r.episode} "${r.title}"`);
    const wall = fromSeconds(r.wallTimeSeconds);
    const total = fromSeconds(r.durationSeconds);
    log.info(`  Transcription time:  ${wall.human} (${pct}% of ${total.timestamp})`);
    log.info(`  Output:              "${basename(r.outputPath)}"`);
  }

  const failures = outcomes.filter((o) => o.status !== 'completed' && o.status !== 'skipped');
  if (failures.length > 0) {
    log.info('');
    log.warn('Failures:');
    for (const f of failures) {
      if (f.status === 'not_found') {
        log.warn(`  Episode ${f.episode}: not found in feed`);
      } else if ('error' in f) {
        log.warn(`  Episode ${f.episode}: ${f.status.replace('_', ' ')} — ${f.error}`);
      }
    }
  }

  return { outcomes };
}

// =============================================================================
// Summarize pipeline
// =============================================================================
export async function runSummarizePipeline(opts: SummarizeOptions): Promise<SummarizeResult> {
  const model = opts.model ?? DEFAULT_WHISPER_MODEL;
  const summaryModel = opts.summaryModel ?? DEFAULT_SUMMARY_MODEL;
  const force = opts.force ?? false;

  const log = createLogger();
  const outcomes: SummarizeOutcome[] = [];

  log.info(`Summarizing ${opts.episodes.length} ${pluralize(opts.episodes.length, 'episode')} using Whisper model: ${pc.blue(model)}, summary model: ${pc.blue(summaryModel)}`);
  log.info('');

  for (const epNum of opts.episodes) {
    const transcriptFile = findTranscript(epNum, model);
    if (!transcriptFile) {
      const msg = `Episode ${epNum}: no transcription found for model "${model}"`;
      log.error(pc.red(msg));
      log.record('error', msg);
      outcomes.push({ status: 'no_transcript', episode: epNum });
      continue;
    }

    const paths = episodePaths({ episode: epNum, model, summaryModel });

    // Load metadata for context
    let title = '';
    let description = '';
    try {
      const meta = JSON.parse(readFileSync(paths.rss, 'utf-8'));
      title = meta.title ?? '';
      description = meta.description ?? '';
    } catch {
      // metadata file may not exist
    }

    try {
      const { skipped, result, usage } = await summarizeEpisode({
        transcriptPath: transcriptFile,
        summaryPath: paths.summary!,
        title,
        description,
        summaryModel,
        force,
        log: (msg) => log.info(`  ${msg}`),
      });

      if (skipped) {
        log.info(pc.yellow(`Episode ${epNum}: summary already exists (use --force to overwrite)`));
        outcomes.push({ status: 'skipped', episode: epNum });
      } else if (result) {
        const details: Record<string, string> = { 'Model': summaryModel };
        if (usage) {
          details['Tokens'] = `input ${formatNumber(usage.prompt)} / output ${formatNumber(usage.completion)}`;
        }
        log.record('info', `Saved summary: "${basename(paths.summary!)}"`, details);
        outcomes.push({ status: 'completed', episode: epNum, result });
      }
    } catch (err) {
      log.error(pc.red(`  Summarization failed: ${(err as Error).message}`));
      log.record('error', `Summarization failed for episode ${epNum}: ${(err as Error).message}`);
      outcomes.push({ status: 'failed', episode: epNum, error: (err as Error).message });
    }

    log.info('');
  }

  return { outcomes };
}
