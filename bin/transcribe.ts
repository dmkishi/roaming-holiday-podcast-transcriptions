import minimist from 'minimist';
import { runTranscribePipeline } from '@lib/pipeline.js';
import { DEFAULT_WHISPER_MODEL, DEFAULT_SUMMARY_MODEL } from '@lib/config/models.js';

const argv = minimist(process.argv.slice(2), {
  string: ['model', 'summary-model'],
  boolean: ['force', 'summarize'],
  default: {
    model: DEFAULT_WHISPER_MODEL,
    'summary-model': DEFAULT_SUMMARY_MODEL,
    force: false,
    summarize: false,
  },
});

const episodes = argv._.map(Number).filter((n) => !isNaN(n));
if (episodes.length === 0) {
  console.error(
    `Usage: pnpm transcribe <episode-numbers...> [--model ${DEFAULT_WHISPER_MODEL}] [--force] [--summarize] [--summary-model ${DEFAULT_SUMMARY_MODEL}]`
  );
  process.exit(1);
}

const outcomes = await runTranscribePipeline({
  episodes,
  model: argv.model,
  force: argv.force,
  summarize: argv.summarize,
  summaryModel: argv['summary-model'],
});

const failed = outcomes.some((o) => o.status !== 'completed' && o.status !== 'skipped');
if (failed) process.exit(1);
