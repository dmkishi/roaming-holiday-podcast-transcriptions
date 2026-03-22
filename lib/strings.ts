export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return count === 1 ? singular : plural;
}

/**
 * Converts a string into a URL-friendly handle by lowercasing, replacing non-
 * alphanumeric runs with hyphens, and trimming leading/trailing hyphens.
 *
 * "Hello World!" → "hello-world"
 */
export function handelize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
