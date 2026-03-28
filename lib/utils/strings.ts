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

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}
