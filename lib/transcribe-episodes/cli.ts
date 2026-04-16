import minimist from 'minimist';
import { DEFAULT_WHISPER_MODEL, DEFAULT_SUMMARY_MODEL } from '@lib/config/llm.js';

interface CliOptions {
  episodeNums: Set<number>;
  transcribeModel: string;
  summaryModel: string;
  runPipeline: {
    runTranscript: boolean;
    runParagraph: boolean;
    runSummary: boolean;
  };
  forceRss: boolean;
  forceDownload: boolean;
  forceVad: boolean;
  forceTranscribe: boolean;
}

export function getTranscribeCliArgs(args: string[]): CliOptions {
  const argv = minimist<{
    model: string;
    'summary-model': string;
    'only-paragraphs': boolean;
    'only-summaries': boolean;
    'force-all': boolean;
    'force-rss': boolean;
    'force-download': boolean;
    'force-vad': boolean;
    'force-transcribe': boolean;
  }>(args.slice(2), {
    string: ['model', 'summary-model'],
    boolean: [
      'only-paragraphs',
      'only-summaries',
      'force-all',
      'force-rss',
      'force-download',
      'force-vad',
      'force-transcribe',
    ],
    default: {
      model: DEFAULT_WHISPER_MODEL,
      'summary-model': DEFAULT_SUMMARY_MODEL,
      'only-paragraphs': false,
      'only-summaries': false,
      'force-all': false,
      'force-rss': false,
      'force-download': false,
      'force-vad': false,
      'force-transcribe': false,
    },
  });

  const episodeNums = new Set(argv._.map(Number).filter((n) => !isNaN(n)));
  if (episodeNums.size === 0) {
    console.error(
      `Usage: pnpm transcribe <episode-numbers...> [--model ${DEFAULT_WHISPER_MODEL}] [--summary-model ${DEFAULT_SUMMARY_MODEL}] [--only-paragraphs] [--only-summaries] [--force-all] [--force-rss] [--force-download] [--force-vad] [--force-transcribe]`,
    );
    process.exit(1);
  }

  const onlyParagraphs = argv['only-paragraphs'];
  const onlySummaries = argv['only-summaries'];
  const runTranscript = !onlyParagraphs && !onlySummaries;
  const runParagraph = runTranscript || onlyParagraphs;
  const runSummary = runTranscript || onlySummaries;

  // Forcing a transcription stage cascades to every downstream transcription
  // stage that consumes its output. Pipeline: rss → download → vad → transcribe.
  // `force-rss` is intentionally isolated: refetching the RSS only refreshes
  // metadata and does not invalidate downloaded MP3s.
  //
  // Tail stages (paragraph, paragraphGroup, summary) always regenerate when
  // they run, so they have no force flags.
  //
  // `--only-*` short-circuits the transcript pipeline, so transcription force
  // flags are inert in that mode and silently ignored.
  const forceAll = runTranscript && argv['force-all'];
  const forceRss = runTranscript && (forceAll || argv['force-rss']);
  const forceDownload = runTranscript && (forceAll || argv['force-download']);
  const forceVad = runTranscript && (forceDownload || argv['force-vad']);
  const forceTranscribe = runTranscript && (forceVad || argv['force-transcribe']);

  return {
    episodeNums,
    transcribeModel: argv.model,
    summaryModel: argv['summary-model'],
    runPipeline: { runTranscript, runParagraph, runSummary },
    forceRss,
    forceDownload,
    forceVad,
    forceTranscribe,
  };
}
