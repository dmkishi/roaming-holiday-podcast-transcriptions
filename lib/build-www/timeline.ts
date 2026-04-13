import type { TranscriptSegment } from '@lib/build-www/types.js';

/**
 * Flag segments at regular intervals as timeline markers for display in the
 * page margin.
 */
export function addTimelineMarkers(
  paragraphs: TranscriptSegment[][],
  intervalMinutes = 5,
): TranscriptSegment[][] {
  const intervalSeconds = intervalMinutes * 60;
  let lastMarker = -1;

  return paragraphs.map((paragraph) =>
    paragraph.map((seg) => {
      const markerIndex = Math.floor(seg.start / intervalSeconds);
      if (markerIndex > lastMarker) {
        lastMarker = markerIndex;
        return { ...seg, timelineMarker: true };
      }
      return seg;
    }),
  );
}
