import minimist from 'minimist';
import { DEFAULT_WHISPER_MODEL } from '@lib/config/llm.js';

interface CliOptions {
  episodeNums: Set<number>;
  transcribeModel: string;
  runPipeline: {
    runTranscript: boolean;
    runParagraph: boolean;
  };
  forceRss: boolean;
  forceDownload: boolean;
  forceVad: boolean;
  forceFade: boolean;
  forceTranscribe: boolean;
}

export function getTranscribeCliArgs(args: string[]): CliOptions {
  const argv = minimist<{
    model: string;
    'only-paragraphs': boolean;
    'force-all': boolean;
    'force-rss': boolean;
    'force-download': boolean;
    'force-vad': boolean;
    'force-fade': boolean;
    'force-transcribe': boolean;
  }>(args.slice(2), {
    string: ['model'],
    boolean: [
      'only-paragraphs',
      'force-all',
      'force-rss',
      'force-download',
      'force-vad',
      'force-fade',
      'force-transcribe',
    ],
    default: {
      model: DEFAULT_WHISPER_MODEL,
      'only-paragraphs': false,
      'force-all': false,
      'force-rss': false,
      'force-download': false,
      'force-vad': false,
      'force-fade': false,
      'force-transcribe': false,
    },
  });

  const episodeNums = new Set(argv._.map(Number).filter((n) => !isNaN(n)));
  if (episodeNums.size === 0) {
    console.error(
      `Usage: pnpm transcribe <episode-numbers...> [--model ${DEFAULT_WHISPER_MODEL}] [--only-paragraphs] [--force-all] [--force-rss] [--force-download] [--force-vad] [--force-fade] [--force-transcribe]`,
    );
    process.exit(1);
  }

  const onlyParagraphs = argv['only-paragraphs'];
  const runTranscript = !onlyParagraphs;
  const runParagraph = runTranscript || onlyParagraphs;

  // Forcing a transcription stage cascades to every downstream transcription
  // stage that consumes its output. Pipeline: rss → download → vad → transcribe.
  // `force-rss` is intentionally isolated: refetching the RSS only refreshes
  // metadata and does not invalidate downloaded MP3s.
  //
  // Fade runs in the paragraph phase (not the transcript pipeline), so
  // `--force-fade` is valid in `--only-paragraphs` mode. Forcing download
  // still cascades into fade, since a re-downloaded MP3 invalidates any fade
  // sidecar derived from the prior file.
  //
  // Tail stages (paragraph, paragraphGroup) always regenerate when they run,
  // so they have no force flags.
  //
  // `--only-paragraphs` short-circuits the transcript pipeline, so
  // transcript-stage force flags are inert in that mode and silently ignored.
  const forceAll = runTranscript && argv['force-all'];
  const forceRss = runTranscript && (forceAll || argv['force-rss']);
  const forceDownload = runTranscript && (forceAll || argv['force-download']);
  const forceVad = runTranscript && (forceDownload || argv['force-vad']);
  const forceFade = runParagraph && (forceDownload || argv['force-fade']);
  const forceTranscribe = runTranscript && (forceVad || argv['force-transcribe']);

  return {
    episodeNums,
    transcribeModel: argv.model,
    runPipeline: { runTranscript, runParagraph },
    forceRss,
    forceDownload,
    forceVad,
    forceFade,
    forceTranscribe,
  };
}
