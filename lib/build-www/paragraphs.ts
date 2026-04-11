import type { TranscriptSegment } from '@lib/build-www/types.js';

/**
 * Group segments into paragraphs using the break indices from a paragraph
 * sidecar file. `breaks` is assumed well-formed: non-empty and starting at 0
 * (guaranteed by the generator in `lib/transcribe-episodes/paragraph.ts`).
 */
export function groupByParagraphBreaks(
  segments: TranscriptSegment[],
  breaks: number[],
): TranscriptSegment[][] {
  if (segments.length === 0) return [];
  const groups: TranscriptSegment[][] = [];
  for (let i = 0; i < breaks.length; i++) {
    const start = breaks[i]!;
    const end = breaks[i + 1] ?? segments.length;
    groups.push(segments.slice(start, end));
  }
  return groups;
}
