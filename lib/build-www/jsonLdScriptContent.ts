/**
 * @file Import-free so Eleventy can register it as a filter without pulling in
 * the `@lib`-aliased data builders.
 */

export function jsonLdScriptContent(data: unknown): string {
  // eslint-disable-next-line unicorn/prefer-string-raw
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}
