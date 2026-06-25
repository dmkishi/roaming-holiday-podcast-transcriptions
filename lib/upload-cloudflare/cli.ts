import minimist from 'minimist';

interface CliOptions {
  episodeNums: Set<number> | 'all';
  force: boolean;
}

export function getUploadCliArgs(args: string[]): CliOptions {
  const argv = minimist<{ force: boolean }>(args.slice(2), {
    boolean: ['force'],
    default: { force: false },
  });

  const usage = `Usage: pnpm upload-cloudflare [<episodes...>] [--force]
       <episodes...> accepts integers and ranges, e.g. 100 101 120-129
       When omitted, every episode Markdown file in www/dist/episodes/ is uploaded.
       Run \`pnpm www:build\` first to generate those files.`;

  const tokens = argv._.map(String);
  if (tokens.length === 0) {
    return { episodeNums: 'all', force: argv.force };
  }

  const result = parseEpisodeNums(tokens);
  if ('error' in result) {
    console.error(`${result.error}\n${usage}`);
    process.exit(1);
  }

  return { episodeNums: result.episodeNums, force: argv.force };
}

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
  return { episodeNums };
}
