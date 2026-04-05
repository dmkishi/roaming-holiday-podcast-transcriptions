import minimist from 'minimist';
import { DEFAULT_WHISPER_MODEL, DEFAULT_SUMMARY_MODEL } from '@lib/config/llm.js';

interface CliOptions {
  episodeNums: Set<number>;
  transcribeModel: string;
  summaryModel: string;
  forceRss: boolean;
  forceDownload: boolean;
  forceTranscribe: boolean;
  forceSummarize: boolean;
}

export function getTranscribeCliArgs(args: string[]): CliOptions {
  const argv = minimist<{
    model: string;
    'summary-model': string;
    'force-all': boolean;
    'force-rss': boolean;
    'force-download': boolean;
    'force-transcribe': boolean;
    'force-summarize': boolean;
  }>(args.slice(2), {
    string: ['model', 'summary-model'],
    boolean: [
      'force-all',
      'force-rss',
      'force-download',
      'force-transcribe',
      'force-summarize',
    ],
    default: {
      model: DEFAULT_WHISPER_MODEL,
      'summary-model': DEFAULT_SUMMARY_MODEL,
      'force-all': false,
      'force-rss': false,
      'force-download': false,
      'force-transcribe': false,
      'force-summarize': false,
    },
  });

  const episodeNums = new Set(argv._.map(Number).filter((n) => !isNaN(n)));
  if (episodeNums.size === 0) {
    console.error(
      `Usage: pnpm transcribe <episode-numbers...> [--model ${DEFAULT_WHISPER_MODEL}] [--summary-model ${DEFAULT_SUMMARY_MODEL}] [--force-all] [--force-rss] [--force-download] [--force-transcribe] [--force-summarize]`,
    );
    process.exit(1);
  }

  const forceAll = argv['force-all'];
  return {
    episodeNums,
    transcribeModel: argv.model,
    summaryModel: argv['summary-model'],
    forceRss: forceAll || argv['force-rss'],
    forceDownload: forceAll || argv['force-download'],
    forceTranscribe: forceAll || argv['force-transcribe'],
    forceSummarize: forceAll || argv['force-summarize'],
  };
}

interface SummarizeCliOptions {
  episodeNums: Set<number>;
  summaryModel: string;
  force: boolean;
}

export function getSummarizeCliArgs(args: string[]): SummarizeCliOptions {
  const argv = minimist<{
    model: string;
    force: boolean;
  }>(args.slice(2), {
    string: ['model'],
    boolean: ['force'],
    default: {
      model: DEFAULT_SUMMARY_MODEL,
      force: false,
    },
  });

  const episodeNums = new Set(argv._.map(Number).filter((n) => !isNaN(n)));
  if (episodeNums.size === 0) {
    console.error(
      `Usage: pnpm summarize <episode-numbers...> [--model ${DEFAULT_SUMMARY_MODEL}] [--force]`,
    );
    process.exit(1);
  }

  return {
    episodeNums,
    summaryModel: argv.model,
    force: argv.force,
  };
}
