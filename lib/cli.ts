import minimist from 'minimist';
import { DEFAULT_WHISPER_MODEL, DEFAULT_SUMMARY_MODEL } from '@lib/config/llm.js';

interface CliOptions {
  episodeNums: Set<number>;
  transcribeModel: string;
  summaryModel: string;
  skipSummary: boolean;
  force: boolean;
}

export function getCliArgs(args: string[]): CliOptions {
  const argv = minimist(args.slice(2), {
    string: ['model', 'summary-model'],
    boolean: ['force', 'skip-summary'],
    default: {
      model: DEFAULT_WHISPER_MODEL,
      'summary-model': DEFAULT_SUMMARY_MODEL,
      'skip-summary': false,
      force: false,
    },
  });

  const episodeNums = new Set(argv._.map(Number).filter((n) => !isNaN(n)));
  if (episodeNums.size === 0) {
    console.error(
      `Usage: pnpm transcribe <episode-numbers...> [--model ${DEFAULT_WHISPER_MODEL}] [--force] [--skip-summary] [--summary-model ${DEFAULT_SUMMARY_MODEL}]`,
    );
    process.exit(1);
  }

  return {
    episodeNums,
    transcribeModel: argv['model'],
    summaryModel: argv['summary-model'],
    skipSummary: argv['skip-summary'],
    force: argv['force'],
  };
}
