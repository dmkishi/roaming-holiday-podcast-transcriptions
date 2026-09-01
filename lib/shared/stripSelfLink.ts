import { BASE_URL } from '#lib/config/site.ts';

/**
 * Removes this site's own URL, e.g. "Transcripts:
 * https://dmkishi.github.io/roaming-holiday-podcast-transcriptions/", which the
 * podcast author appends to episode descriptions. It is redundant on the site
 * itself, and it wastes scarce tokens in the Whisper prompt.
 */
export function stripSelfLink(input: string, baseUrl = BASE_URL): string {
  const escaped = baseUrl.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
  /** Optional "Transcripts:"-style label, then our own URL, then an optional slash. */
  const selfLink = new RegExp(
    String.raw`(?:transcripts?\s*[:-]?\s*)?${escaped}/?`,
    'giu',
  );
  return input.replaceAll(selfLink, ' ').replaceAll(/\s+/gu, ' ').trim();
}
