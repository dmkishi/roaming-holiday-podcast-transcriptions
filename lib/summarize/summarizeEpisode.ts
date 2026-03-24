import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { print } from '@lib/print.js';
import { formatNumber } from '@lib/strings.js';
import { TranscriptSchema } from '@lib/transcribe/schema.js';
import { summarize, type SummaryResult, type TokenUsage } from './llm.js';

export interface SummarizeEpisodeOptions {
  transcriptPath: string;
  summaryPath: string;
  title: string;
  description: string;
  summaryModel: string;
  force?: boolean;
}

export interface SummarizeEpisodeResult {
  skipped: boolean;
  result?: SummaryResult;
  usage?: TokenUsage;
}

export async function summarizeEpisode(
  opts: SummarizeEpisodeOptions
): Promise<SummarizeEpisodeResult> {
  // Skip if summary already exists (unless --force is set.)
  if (existsSync(opts.summaryPath) && !opts.force) {
    return { skipped: true };
  }

  // Extract the `text` property from transcript JSON.
  print.info(`  Extracting text from "${basename(opts.transcriptPath)}"...`);
  const raw = readFileSync(opts.transcriptPath, 'utf-8');
  const text = TranscriptSchema.parse(JSON.parse(raw)).text.trim();
  print.info(`  Text length: ${formatNumber(text.length)} characters`);

  // Call LLM to summarize.
  print.info(`  Sending to ${opts.summaryModel} for summarization...`);
  const { result, usage } = await summarize(text, {
    title: opts.title,
    description: opts.description,
  }, opts.summaryModel);

  // Write summary result to file.
  writeFileSync(opts.summaryPath, JSON.stringify(result, null, 2) + '\n');
  print.info(`  Written: "${basename(opts.summaryPath)}"`);

  return { skipped: false, result, usage };
}
