import minimist from 'minimist';
import { DEFAULT_MODEL } from '@lib/config/whisper.js';

interface CliOptions {
  episodeNums: Set<number>;
  transcribeModel: string;
  runPipeline: {
    runTranscript: boolean;
    runParagraph: boolean;
    runMarkdown: boolean;
  };
  forceRss: boolean;
  forceDownload: boolean;
  forceGaps: boolean;
  forceFade: boolean;
  forceTranscribe: boolean;
}

export function getTranscribeCliArgs(args: string[]): CliOptions {
  const argv = minimist<{
    model: string;
    'only-paragraphs': boolean;
    'only-markdown': boolean;
    'force-all': boolean;
    'force-rss': boolean;
    'force-download': boolean;
    'force-gaps': boolean;
    'force-fade': boolean;
    'force-transcribe': boolean;
  }>(args.slice(2), {
    string: ['model'],
    boolean: [
      'only-paragraphs',
      'only-markdown',
      'force-all',
      'force-rss',
      'force-download',
      'force-gaps',
      'force-fade',
      'force-transcribe',
    ],
    default: {
      model: DEFAULT_MODEL,
      'only-paragraphs': false,
      'only-markdown': false,
      'force-all': false,
      'force-rss': false,
      'force-download': false,
      'force-gaps': false,
      'force-fade': false,
      'force-transcribe': false,
    },
  });

  const usage = `Usage: pnpm transcribe <episodes...> [--model ${DEFAULT_MODEL}] [--only-paragraphs | --only-markdown] [--force-all] [--force-rss] [--force-download] [--force-gaps] [--force-fade] [--force-transcribe]
       <episodes...> accepts integers and ranges, e.g. 100 101 120-129`;

  const result = parseEpisodeNums(argv._.map(String));
  if ('error' in result) {
    console.error(`${result.error}\n${usage}`);
    process.exit(1);
  }
  const { episodeNums } = result;

  const onlyParagraphs = argv['only-paragraphs'];
  const onlyMarkdown = argv['only-markdown'];
  if (onlyParagraphs && onlyMarkdown) {
    console.error(`--only-paragraphs and --only-markdown are mutually exclusive\n${usage}`);
    process.exit(1);
  }

  // Reject force flags that would be inert under the selected mode rather than
  // silently ignoring them. Transcript-stage force flags are inert under both
  // `--only-paragraphs` and `--only-markdown`; `--force-fade` is additionally
  // inert under `--only-markdown` (fade runs in the paragraph phase). Markdown
  // has no force flag of its own - `writeMarkdown` overwrites unconditionally.
  const transcriptForceFlags = [
    'force-all', 'force-rss', 'force-download', 'force-gaps', 'force-transcribe',
  ] as const;
  if (onlyParagraphs) {
    const conflicts = transcriptForceFlags.filter((f) => argv[f]);
    if (conflicts.length > 0) {
      console.error(`--only-paragraphs is incompatible with ${conflicts.map((f) => `--${f}`).join(', ')}\n${usage}`);
      process.exit(1);
    }
  }
  if (onlyMarkdown) {
    const conflicts = [...transcriptForceFlags, 'force-fade' as const].filter((f) => argv[f]);
    if (conflicts.length > 0) {
      console.error(`--only-markdown is incompatible with ${conflicts.map((f) => `--${f}`).join(', ')}\n${usage}`);
      process.exit(1);
    }
  }

  const runTranscript = !onlyParagraphs && !onlyMarkdown;
  const runParagraph = runTranscript || onlyParagraphs;
  const runMarkdown = true;

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
  // Tail stages (paragraph, markdown) always regenerate when they run, so they
  // have no force flags. Inert force flags under each `--only-*` mode are
  // rejected up front (see argv validation above).
  const forceAll = runTranscript && argv['force-all'];
  const forceRss = runTranscript && (forceAll || argv['force-rss']);
  const forceDownload = runTranscript && (forceAll || argv['force-download']);
  const forceGaps = runTranscript && (forceDownload || argv['force-gaps']);
  const forceFade = runParagraph && (forceDownload || argv['force-fade']);
  const forceTranscribe = runTranscript && (forceGaps || argv['force-transcribe']);

  return {
    episodeNums,
    transcribeModel: argv.model,
    runPipeline: { runTranscript, runParagraph, runMarkdown },
    forceRss,
    forceDownload,
    forceGaps,
    forceFade,
    forceTranscribe,
  };
}

/**
 * Parses positional CLI tokens into a set of episode numbers.
 */
function parseEpisodeNums(
  tokens: readonly string[],
): { episodeNums: Set<number> } | { error: string } {
  const episodeNums = new Set<number>();
  for (const token of tokens) {
    const range = /^(\d+)-(\d+)$/u.exec(token);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end) {
        return { error: `Invalid range '${token}': start must be <= end.` };
      }
      for (let n = start; n <= end; n++) episodeNums.add(n);
      continue;
    }
    if (/^\d+$/u.test(token)) {
      episodeNums.add(Number(token));
      continue;
    }
    return { error: `Invalid episode argument '${token}'.` };
  }
  if (episodeNums.size === 0) {
    return { error: 'No episodes specified.' };
  }
  return { episodeNums };
}
