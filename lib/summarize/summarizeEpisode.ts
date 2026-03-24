import { basename } from 'node:path';
import { formatNumber } from '@lib/strings.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { summarize, type SummaryResult } from './llm.js';

export interface SummarizeEpisodeOptions {
  transcriptionPath: string;
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
 *   - extract only the text property from the transcription JSON,
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

  log(`Extracting text from "${basename(opts.transcriptionPath)}"...`);
  const raw = readFileSync(opts.transcriptionPath, 'utf-8');
  const text = (JSON.parse(raw) as { text: string }).text.trim();
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
