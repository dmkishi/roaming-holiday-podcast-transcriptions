import { readFileSync } from 'node:fs';
import { getSummarizeCliArgs } from '@lib/transcribe-episodes/cli.js';
import { episodePaths, findTranscripts, toRelative } from '@lib/transcribe-episodes/paths.js';
import { promptSummary, type Summary, type SummaryInput } from '@lib/transcribe-episodes/summary.js';
import { MetadataFileSchema } from '@lib/shared/schemas.js';
import { formatNumber, pluralize } from '@lib/shared/strings.js';
import { print, printAndLog } from '@lib/shared/print.js';

interface LoadedTranscript extends SummaryInput {
  transcriptModel: string;
}

// =============================================================================
// Parse CLI args
// =============================================================================
const opts = getSummarizeCliArgs(process.argv);
printAndLog.info([
  `Summarize ${pluralize(opts.episodeNums.size, 'episode')}: ${[...opts.episodeNums].join(', ')}`,
  `  Summary model: ${opts.summaryModel}`,
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
  const { path: transcriptPath, model: transcriptModel } = matches[0]!;

  const { metadata: metadataPath } = episodePaths({ episodeNumber, model: '' });
  let title: string;
  let description: string;
  try {
    ({ title, description } = MetadataFileSchema.parse(
      JSON.parse(readFileSync(metadataPath, 'utf8')),
    ));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    printAndLog.warn(`#${episodeNumber}: Failed to load metadata - ${msg} - skipping`);
    continue;
  }

  loaded.push({
    episodeNumber,
    path: transcriptPath,
    title,
    description,
    transcriptModel,
  });
  printAndLog.info(
    `#${episodeNumber}: Loaded "${toRelative(transcriptPath)}" (${transcriptModel})`,
  );
}

if (loaded.length === 0) {
  printAndLog.error('No transcripts to summarize.');
  process.exit(1);
}
print.emptyLine();

// =============================================================================
// Summarize
// =============================================================================
print.info('Summarizing...');
const summaries: Summary[] = [];
for (const { transcriptModel, ...input } of loaded) {
  const res = await promptSummary(
    input,
    opts.summaryModel,
    transcriptModel,
    opts.force,
  );
  if (!res.ok) {
    printAndLog.warn(
      `#${input.episodeNumber}: Failed ${res.error ? ` - ${res.error}` : ''}`,
    );
    continue;
  }
  if (res.status === 'alreadyExists') {
    printAndLog.warn(`#${res.episodeNumber}: Skipping - summary already exists`);
  } else {
    printAndLog.info([
      `#${input.episodeNumber}: Saved "${toRelative(res.path)}"`,
      `  Tokens: input ${formatNumber(res.stats.tokenInput)} / output ${formatNumber(res.stats.tokenOutput)}`,
    ]);
  }
  summaries.push(res);
}

if (summaries.length === 0) {
  printAndLog.error('No summaries generated.');
  process.exit(1);
}
print.emptyLine();
