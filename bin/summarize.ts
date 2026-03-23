import minimist from 'minimist';
import { runSummarizePipeline } from '@lib/pipeline.js';
import { DEFAULT_WHISPER_MODEL, DEFAULT_SUMMARY_MODEL } from '@lib/config/models.js';

const argv = minimist(process.argv.slice(2), {
  string: ['model', 'summary-model'],
  boolean: ['force'],
  default: {
    model: DEFAULT_WHISPER_MODEL,
    'summary-model': DEFAULT_SUMMARY_MODEL,
    force: false,
  },
});

const episodes = argv._.map(Number).filter((n) => !isNaN(n));
if (episodes.length === 0) {
  console.error(
    `Usage: pnpm summarize <episode-numbers...> [--model ${DEFAULT_WHISPER_MODEL}] [--summary-model ${DEFAULT_SUMMARY_MODEL}] [--force]`
  );
  process.exit(1);
}

const result = await runSummarizePipeline({
  episodes,
  model: argv.model,
  summaryModel: argv['summary-model'],
  force: argv.force,
});

const failed = result.outcomes.some((o) => o.status === 'failed' || o.status === 'no_transcription');
if (failed) process.exit(1);
