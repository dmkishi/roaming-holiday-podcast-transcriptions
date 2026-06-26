/**
 * Parses positional CLI tokens into a set of episode numbers.
 *
 * Accepts integers and ranges, e.g. `100 101 120-129`. With `allowEmpty: false`
 * (the default) an empty result is rejected; with `allowEmpty: true` an empty
 * set is returned so callers can treat "no episodes" as a separate case.
 */
export function parseEpisodeNums(
  tokens: readonly string[],
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
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
  if (!allowEmpty && episodeNums.size === 0) {
    return { error: 'No episodes specified.' };
  }
  return { episodeNums };
}
