import { basename } from 'node:path';
import { formatNumber } from '@lib/strings.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { summarize, type SummaryResult } from './llm.js';
import { TranscriptSchema } from '@lib/transcribe/stats.js';

export interface SummarizeEpisodeOptions {
  transcriptPath: string;
  summaryPath: string;
  title: string;
  description: string;
  summaryModel: string;
  force?: boolean;
  log?: (msg: string) => void;
}

export interface SummarizeEpisodeResult {
  skipped: boolean;
  result?: SummaryResult;
}

/**
 * Run the full summarization pipeline for a single episode:
 *   - check for existing output
 *   - extract only the text property from the transcript JSON,
 *   - call LLM,
 *   - write result.
 */
export async function summarizeEpisode(
  opts: SummarizeEpisodeOptions
): Promise<SummarizeEpisodeResult> {
  const log = opts.log ?? (() => {});

  if (existsSync(opts.summaryPath) && !opts.force) {
    return { skipped: true };
  }

  log(`Extracting text from "${basename(opts.transcriptPath)}"...`);
  const raw = readFileSync(opts.transcriptPath, 'utf-8');
  const text = TranscriptSchema.parse(JSON.parse(raw)).text.trim();
  log(`Text length: ${formatNumber(text.length)} characters`);

  log(`Sending to ${opts.summaryModel} for summarization...`);
  const result = await summarize(text, {
    title: opts.title,
    description: opts.description,
  }, opts.summaryModel);

  writeFileSync(opts.summaryPath, JSON.stringify(result, null, 2) + '\n');
  log(`Written: "${basename(opts.summaryPath)}"`);

  return { skipped: false, result };
}
