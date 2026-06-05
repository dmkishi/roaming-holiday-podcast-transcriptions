import { describe, expect, test } from 'vitest';
import { findSegmentFadeBoundaries } from '#lib/transcribe-episodes/paragraph.ts';
import type { FadePair } from '#lib/shared/schemas.ts';

function seg(start: number): { start: number } {
  return { start };
}

function pair(outStart: number, inEnd: number): FadePair {
  return { outStart, outEnd: outStart + 1, inStart: inEnd - 1, inEnd };
}

describe('findSegmentFadeBoundaries', () => {
  test('breaks at the first segment starting at or after the fade-in end', () => {
    const segments = [seg(0), seg(10), seg(30), seg(40)];
    // Music spans ~12..28; speech resumes at 30 (index 2).
    expect(findSegmentFadeBoundaries(segments, [pair(12, 28)])).toEqual([2]);
  });

  test('skips an interlude that falls after all speech', () => {
    const segments = [seg(0), seg(10), seg(20)];
    expect(findSegmentFadeBoundaries(segments, [pair(50, 60)])).toEqual([]);
  });

  test('skips an interlude before all speech (match is index 0)', () => {
    const segments = [seg(30), seg(40), seg(50)];
    expect(findSegmentFadeBoundaries(segments, [pair(5, 20)])).toEqual([]);
  });

  test('de-dupes two interludes that resolve to the same segment', () => {
    const segments = [seg(0), seg(10), seg(40)];
    expect(findSegmentFadeBoundaries(segments, [pair(12, 20), pair(22, 30)])).toEqual([2]);
  });

  test('multiple interludes produce multiple ascending breaks', () => {
    const segments = [seg(0), seg(10), seg(30), seg(40), seg(60)];
    expect(findSegmentFadeBoundaries(segments, [pair(12, 25), pair(42, 55)])).toEqual([2, 4]);
  });

  test('empty fade pairs returns []', () => {
    const segments = [seg(0), seg(10)];
    expect(findSegmentFadeBoundaries(segments, [])).toEqual([]);
  });
});
