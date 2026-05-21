import { describe, expect, test } from 'vitest';
import { buildParagraphBreaks } from '@lib/transcribe-episodes/paragraph.js';

interface TestSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: { text: string; start: number; end: number }[];
}

function seg(id: number, start: number, end: number, text: string): TestSegment {
  return { id, start, end, text, words: [] };
}

function gap(start: number, end: number) {
  return { start, end, duration: end - start };
}

describe('buildParagraphBreaks', () => {
  test('breaks when VAD gap falls between segments and segment ends with period', () => {
    const segments = [
      seg(0, 0, 5, 'First sentence.'),
      seg(1, 7, 12, 'Second sentence.'),
    ];
    const gaps = [gap(5, 7)];
    expect(buildParagraphBreaks(segments, gaps, 1)).toEqual([0, 1]);
  });

  test('does not break when segment lacks sentence-ending punctuation', () => {
    const segments = [
      seg(0, 0, 5, 'Unfinished thought'),
      seg(1, 7, 12, 'continues here.'),
    ];
    const gaps = [gap(5, 7)];
    expect(buildParagraphBreaks(segments, gaps, 1)).toEqual([0]);
  });

  test('does not break when VAD gap is below threshold', () => {
    const segments = [
      seg(0, 0, 5, 'First sentence.'),
      seg(1, 5.5, 10, 'Second sentence.'),
    ];
    const gaps = [gap(5, 5.5)];
    expect(buildParagraphBreaks(segments, gaps, 1)).toEqual([0]);
  });

  test('breaks on question mark and exclamation mark', () => {
    const segments = [
      seg(0, 0, 5, 'Is this working?'),
      seg(1, 7, 12, 'Yes it is!'),
      seg(2, 14, 18, 'Great.'),
    ];
    const gaps = [gap(5, 7), gap(12, 14)];
    expect(buildParagraphBreaks(segments, gaps, 1)).toEqual([0, 1, 2]);
  });

  test('multiple VAD gaps produce multiple breaks', () => {
    const segments = [
      seg(0, 0, 5, 'First.'),
      seg(1, 7, 12, 'Second.'),
      seg(2, 14, 18, 'Third.'),
      seg(3, 20, 25, 'Fourth.'),
    ];
    const gaps = [gap(5, 7), gap(12, 14), gap(18, 20)];
    expect(buildParagraphBreaks(segments, gaps, 1)).toEqual([0, 1, 2, 3]);
  });

  test('empty gaps returns [0]', () => {
    const segments = [
      seg(0, 0, 5, 'Only segment.'),
    ];
    expect(buildParagraphBreaks(segments, [], 1)).toEqual([0]);
  });

  test('ignores VAD gap that falls before all segments or after all segments', () => {
    const segments = [
      seg(0, 5, 10, 'First.'),
      seg(1, 12, 18, 'Second.'),
    ];
    const gaps = [gap(0, 4), gap(19, 22)];
    expect(buildParagraphBreaks(segments, gaps, 1)).toEqual([0]);
  });

  test('does not produce duplicate break indices', () => {
    const segments = [
      seg(0, 0, 5, 'First.'),
      seg(1, 10, 15, 'Second.'),
    ];
    // Two gaps that both map to the same segment boundary
    const gaps = [gap(5, 7), gap(7, 10)];
    expect(buildParagraphBreaks(segments, gaps, 1)).toEqual([0, 1]);
  });
});

