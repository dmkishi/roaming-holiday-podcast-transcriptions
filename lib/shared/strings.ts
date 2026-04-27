/**
 * Date → YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * `1_234_567` → "1,234,567".
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * `1` → "001"
 */
export function formatEpisodeNumber(episodeNumber: number): string {
  return String(episodeNumber).padStart(3, '0');
}

export function handleize(str: string): string {
  return str
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}

export function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, undefined, 2) + '\n';
}
