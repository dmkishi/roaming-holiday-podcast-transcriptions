import { stripHtmlTags } from '#lib/shared/strings.ts';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Sanitizes a string sourced from an RSS feed: strips HTML tags, decodes
 * named/numeric HTML entities, and collapses internal whitespace (including
 * line breaks) to single spaces.
 */
export function sanitizeRssText(input: string): string {
  return stripHtmlTags(input)
    .replaceAll(/&(?<entity>#x?[0-9a-fA-F]+|[a-zA-Z]+);/gu, (match, entity: string) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        const code = parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (entity.startsWith('#')) {
        const code = Math.trunc(Number(entity.slice(1)));
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[entity] ?? match;
    })
    .replaceAll(/\s+/gu, ' ')
    .trim();
}
