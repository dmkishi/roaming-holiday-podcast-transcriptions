import { getParagraphsCliArgs } from '@lib/transcribe-episodes/cli.js';
import { findTranscripts, toRelative } from '@lib/transcribe-episodes/paths.js';
import { writeParagraphs, type ParagraphInput } from '@lib/transcribe-episodes/paragraph.js';
import { writeParagraphGroups } from '@lib/transcribe-episodes/paragraphGroup.js';
import { print, printAndLog } from '@lib/shared/print.js';
import { formatNumber, pluralize } from '@lib/shared/strings.js';

interface LoadedTranscript extends ParagraphInput {
  transcriptModel: string;
}

// =============================================================================
// Parse CLI args
// =============================================================================
const opts = getParagraphsCliArgs(process.argv);
printAndLog.info([
  `Build paragraphs for ${pluralize(opts.episodeNums.size, 'episode')}: ${[...opts.episodeNums].join(', ')}`,
]);
print.emptyLine();

// =============================================================================
// Load transcripts
// =============================================================================
print.info('Loading transcripts...');
const loaded: LoadedTranscript[] = [];
for (const episodeNumber of opts.episodeNums) {
  const matches = findTranscripts(episodeNumber);
  if (matches.length === 0) {
    printAndLog.warn(`#${episodeNumber}: No transcript found - skipping`);
    continue;
  }
  if (matches.length > 1) {
    const models = matches.map((m) => m.model).join(', ');
    printAndLog.warn(`#${episodeNumber}: Multiple transcripts found (${models}) - skipping`);
    continue;
  }
  const { path, model } = matches[0]!;
  loaded.push({ episodeNumber, path, transcriptModel: model });
  printAndLog.info(
    `#${episodeNumber}: Loaded "${toRelative(path)}" (${model})`,
  );
}

if (loaded.length === 0) {
  printAndLog.error('No transcripts to build paragraphs from.');
  process.exit(1);
}
print.emptyLine();

// =============================================================================
// Build paragraphs
// =============================================================================
print.info('Building paragraphs...');
let generatedCount = 0;
for (const { transcriptModel, ...input } of loaded) {
  const res = writeParagraphs(input, transcriptModel, opts.force);
  if (!res.ok) {
    printAndLog.warn(
      `#${input.episodeNumber}: Failed${res.error ? ` - ${res.error}` : ''}`,
    );
    continue;
  }
  if (res.status === 'alreadyExists') {
    printAndLog.warn(`#${res.episodeNumber}: Skipping - paragraph file already exists`);
  } else {
    printAndLog.info([
      `#${input.episodeNumber}: Saved "${toRelative(res.path)}"`,
      `  Paragraphs: ${formatNumber(res.stats.paragraphs)}`,
      `  Segments:   ${formatNumber(res.stats.segments)}`,
    ]);
    generatedCount++;
  }
}

if (generatedCount === 0) {
  printAndLog.warn('No paragraph files generated.');
}
print.emptyLine();

// =============================================================================
// Group paragraphs
// =============================================================================
print.info('Grouping paragraphs...');
for (const { transcriptModel, ...input } of loaded) {
  const res = writeParagraphGroups(input, transcriptModel, opts.force);
  if (!res.ok) {
    printAndLog.warn(
      `#${input.episodeNumber}: Failed${res.error ? ` - ${res.error}` : ''}`,
    );
    continue;
  }
  if (res.status === 'alreadyExists') {
    printAndLog.warn(`#${res.episodeNumber}: Skipping - paragraphGroup file already exists`);
  } else {
    printAndLog.info([
      `#${input.episodeNumber}: Saved "${toRelative(res.path)}"`,
      `  Groups:     ${formatNumber(res.stats.groups)}`,
    ]);
  }
}
print.emptyLine();
