import { resolve, join, basename } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import minimist from 'minimist';
import pc from 'picocolors';
import { summarizeEpisode } from '../lib/summarize/summarizeEpisode.js';
import { pluralize } from '../lib/strings.js';

const DEFAULT_TRANSCRIPTION_MODEL = 'base';
const TRANSCRIPTIONS_DIR = resolve(import.meta.dirname, '../transcriptions');

const argv = minimist(process.argv.slice(2), {
  string: ['model'],
  boolean: ['force'],
  default: { model: DEFAULT_TRANSCRIPTION_MODEL, force: false },
});

const episodeNumbers = argv._.map(Number).filter((n) => !isNaN(n));
if (episodeNumbers.length === 0) {
  console.error('Usage: pnpm summarize <episode-numbers...> [--model base] [--force]');
  process.exit(1);
}

main();

async function main() {
  console.log(`Summarizing ${episodeNumbers.length} ${pluralize(episodeNumbers.length, 'episode')} using transcription model: ${pc.blue(argv.model)}`);
  console.log('');

  for (const epNum of episodeNumbers) {
    const paddedNum = String(epNum).padStart(4, '0');

    // Find the transcription file
    const transcriptionFile = findFile(paddedNum, `--${argv.model}.json`);
    if (!transcriptionFile) {
      console.error(pc.red(`Episode ${epNum}: no transcription found (looked for *${paddedNum}*--${argv.model}.json)`));
      continue;
    }

    // Derive summary output path
    const summaryStem = basename(transcriptionFile).replace(`--${argv.model}.json`, '');
    const summaryPath = join(TRANSCRIPTIONS_DIR, `${summaryStem}.summary.json`);

    // Load metadata for context
    const metaFile = findFile(paddedNum, '.meta.json');
    let title = '';
    let description = '';
    if (metaFile) {
      const meta = JSON.parse(readFileSync(metaFile, 'utf-8'));
      title = meta.title ?? '';
      description = meta.description ?? '';
    }

    try {
      const { skipped, result } = await summarizeEpisode({
        transcriptionPath: transcriptionFile,
        summaryPath,
        episodeNumber: epNum,
        title,
        description,
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

function findFile(paddedNum: string, suffix: string): string | undefined {
  const files = readdirSync(TRANSCRIPTIONS_DIR);
  const match = files.find((f) => f.startsWith(paddedNum) && f.endsWith(suffix));
  return match ? join(TRANSCRIPTIONS_DIR, match) : undefined;
}
