import minimist from 'minimist';
import { parseEpisodeNums } from '#lib/shared/episodeArgs.ts';

interface CliOptions {
  episodeNums: Set<number> | 'all';
  force: boolean;
}

type CliArgsResult =
  | { ok: true; opts: CliOptions }
  | { ok: false; error: string };

const USAGE = `Usage: pnpm upload-cloudflare [<episodes...>] [--force]
       <episodes...> accepts integers and ranges, e.g. 100 101 120-129
       When omitted, every episode Markdown file in www/dist/episodes/ is uploaded.
       Run \`pnpm www:build\` first to generate those files.`;

export function getUploadCliArgs(args: string[]): CliArgsResult {
  const argv = minimist<{ force: boolean }>(args.slice(2), {
    boolean: ['force'],
    default: { force: false },
  });

  const tokens = argv._.map(String);
  if (tokens.length === 0) {
    return { ok: true, opts: { episodeNums: 'all', force: argv.force } };
  }

  const result = parseEpisodeNums(tokens, { allowEmpty: true });
  if ('error' in result) {
    return { ok: false, error: `${result.error}\n${USAGE}` };
  }

  return { ok: true, opts: { episodeNums: result.episodeNums, force: argv.force } };
}
