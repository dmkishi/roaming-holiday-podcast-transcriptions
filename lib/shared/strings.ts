/**
 * Date → YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Date string → long-form US English date, e.g. "April 4, 2026".
 *
 * Formatted in UTC so the output is independent of the build machine's
 * timezone and consistent with `formatDate`'s UTC-based dates.
 */
export function formatLongDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
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
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '');
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

/**
 * Strips HTML tags from a string, e.g. "<p>Hi</p>" → "Hi".
 */
export function stripHtmlTags(str: string): string {
  return str.replaceAll(/<[^>]*>/gu, '');
}
