import { readFileSync } from 'node:fs';
import minimist from 'minimist';
import pc from 'picocolors';
import { summarizeEpisode } from '@lib/summarize/summarizeEpisode.js';
import { pluralize } from '@lib/strings.js';
import { episodePaths, findTranscription } from '@lib/paths.js';

const DEFAULT_TRANSCRIPTION_MODEL = 'base';
const DEFAULT_SUMMARY_MODEL = 'gpt-4o';

const argv = minimist(process.argv.slice(2), {
  string: ['model', 'summary-model'],
  boolean: ['force'],
  default: { model: DEFAULT_TRANSCRIPTION_MODEL, 'summary-model': DEFAULT_SUMMARY_MODEL, force: false },
});

const episodeNumbers = argv._.map(Number).filter((n) => !isNaN(n));
if (episodeNumbers.length === 0) {
  console.error('Usage: pnpm summarize <episode-numbers...> [--model base] [--summary-model gpt-4o] [--force]');
  process.exit(1);
}

main();

async function main() {
  const summaryModel = argv['summary-model'];
  console.log(`Summarizing ${episodeNumbers.length} ${pluralize(episodeNumbers.length, 'episode')} using transcription model: ${pc.blue(argv.model)}, summary model: ${pc.blue(summaryModel)}`);
  console.log('');

  for (const epNum of episodeNumbers) {
    // Find the transcription file
    const transcriptionFile = findTranscription(epNum, argv.model);
    if (!transcriptionFile) {
      console.error(pc.red(`Episode ${epNum}: no transcription found for model "${argv.model}"`));
      continue;
    }

    const paths = episodePaths({ episode: epNum, model: argv.model, summaryModel });

    // Load metadata for context
    let title = '';
    let description = '';
    try {
      const meta = JSON.parse(readFileSync(paths.meta, 'utf-8'));
      title = meta.title ?? '';
      description = meta.description ?? '';
    } catch {
      // metadata file may not exist
    }

    try {
      const { skipped, result } = await summarizeEpisode({
        transcriptionPath: transcriptionFile,
        summaryPath: paths.summary!,
        episodeNumber: epNum,
        title,
        description,
        summaryModel,
        force: argv.force,
        log: (msg) => console.log(`  ${msg}`),
      });

      if (skipped) {
        console.log(pc.yellow(`Episode ${epNum}: summary already exists (use --force to overwrite)`));
      } else if (result) {
        console.log(`  Summary: ${result.summary.slice(0, 100)}...`);
        console.log(`  Keywords: ${result.keywords.join(', ')}`);
        console.log(`  Places: ${result.places.join(', ')}`);
      }
    } catch (err) {
      console.error(pc.red(`  Summarization failed: ${(err as Error).message}`));
    }

    console.log('');
  }
}

