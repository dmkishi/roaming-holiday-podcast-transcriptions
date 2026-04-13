import minimist from 'minimist';
import { DEFAULT_WHISPER_MODEL, DEFAULT_SUMMARY_MODEL } from '@lib/config/llm.js';

interface CliOptions {
  episodeNums: Set<number>;
  transcribeModel: string;
  summaryModel: string;
  forceRss: boolean;
  forceDownload: boolean;
  forceVad: boolean;
  forceTranscribe: boolean;
  forceParagraph: boolean;
  forceParagraphGroup: boolean;
  forceSummarize: boolean;
}

export function getTranscribeCliArgs(args: string[]): CliOptions {
  const argv = minimist<{
    model: string;
    'summary-model': string;
    'force-all': boolean;
    'force-rss': boolean;
    'force-download': boolean;
    'force-vad': boolean;
    'force-transcribe': boolean;
    'force-paragraph': boolean;
    'force-paragraph-group': boolean;
    'force-summarize': boolean;
  }>(args.slice(2), {
    string: ['model', 'summary-model'],
    boolean: [
      'force-all',
      'force-rss',
      'force-download',
      'force-vad',
      'force-transcribe',
      'force-paragraph',
      'force-paragraph-group',
      'force-summarize',
    ],
    default: {
      model: DEFAULT_WHISPER_MODEL,
      'summary-model': DEFAULT_SUMMARY_MODEL,
      'force-all': false,
      'force-rss': false,
      'force-download': false,
      'force-vad': false,
      'force-transcribe': false,
      'force-paragraph': false,
      'force-paragraph-group': false,
      'force-summarize': false,
    },
  });

  const episodeNums = new Set(argv._.map(Number).filter((n) => !isNaN(n)));
  if (episodeNums.size === 0) {
    console.error(
      `Usage: pnpm transcribe <episode-numbers...> [--model ${DEFAULT_WHISPER_MODEL}] [--summary-model ${DEFAULT_SUMMARY_MODEL}] [--force-all] [--force-rss] [--force-download] [--force-vad] [--force-transcribe] [--force-paragraph] [--force-paragraph-group] [--force-summarize]`,
    );
    process.exit(1);
  }

  // Forcing a stage cascades to every downstream stage that consumes its
  // output, so a single flag regenerates the whole dependent tail instead of
  // leaving stale cached artifacts. Pipeline:
  //   rss → download → vad → transcribe → {paragraph → paragraphGroup, summarize}
  // `force-rss` is intentionally isolated: refetching the RSS only refreshes
  // metadata and does not invalidate downloaded MP3s.
  const forceAll = argv['force-all'];
  const forceRss = forceAll || argv['force-rss'];
  const forceDownload = forceAll || argv['force-download'];
  const forceVad = forceDownload || argv['force-vad'];
  const forceTranscribe = forceVad || argv['force-transcribe'];
  const forceParagraph = forceTranscribe || argv['force-paragraph'];
  const forceParagraphGroup = forceParagraph || argv['force-paragraph-group'];
  const forceSummarize = forceTranscribe || argv['force-summarize'];
  return {
    episodeNums,
    transcribeModel: argv.model,
    summaryModel: argv['summary-model'],
    forceRss,
    forceDownload,
    forceVad,
    forceTranscribe,
    forceParagraph,
    forceParagraphGroup,
    forceSummarize,
  };
}

interface ParagraphsCliOptions {
  episodeNums: Set<number>;
  force: boolean;
}

export function getParagraphsCliArgs(args: string[]): ParagraphsCliOptions {
  const argv = minimist<{ force: boolean }>(args.slice(2), {
    boolean: ['force'],
    default: { force: false },
  });

  const episodeNums = new Set(argv._.map(Number).filter((n) => !isNaN(n)));
  if (episodeNums.size === 0) {
    console.error(
      'Usage: pnpm paragraphs <episode-numbers...> [--force]',
    );
    process.exit(1);
  }

  return {
    episodeNums,
    force: argv.force,
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
