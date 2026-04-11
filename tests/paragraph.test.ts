import { describe, expect, test } from 'vitest';
import { buildParagraphBreaks, buildParagraphTexts } from '@lib/transcribe-episodes/paragraph.js';

interface TestSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

function seg(id: number, start: number, end: number, text: string): TestSegment {
  return { id, start, end, text };
}

describe('buildParagraphBreaks', () => {
  test('single segment returns [0]', () => {
    const segments = [seg(0, 0, 5, 'Hello world.')];
    expect(buildParagraphBreaks(segments, 2)).toEqual([0]);
  });

  test('breaks when both gap and period conditions are met', () => {
    const segments = [
      seg(0, 0, 5, 'First sentence.'),
      seg(1, 8, 12, 'Second sentence.'),
    ];
    expect(buildParagraphBreaks(segments, 2)).toEqual([0, 1]);
  });

  test('does not break on gap without period', () => {
    const segments = [
      seg(0, 0, 5, 'Unfinished thought'),
      seg(1, 10, 15, 'continues here.'),
    ];
    expect(buildParagraphBreaks(segments, 2)).toEqual([0]);
  });

  test('does not break on period without sufficient gap', () => {
    const segments = [
      seg(0, 0, 5, 'First sentence.'),
      seg(1, 5.5, 10, 'Second sentence.'),
    ];
    expect(buildParagraphBreaks(segments, 2)).toEqual([0]);
  });

  test('gap exactly at threshold triggers a break', () => {
    const segments = [
      seg(0, 0, 5, 'First.'),
      seg(1, 7, 10, 'Second.'),
    ];
    expect(buildParagraphBreaks(segments, 2)).toEqual([0, 1]);
  });

  test('trailing whitespace does not prevent period detection', () => {
    const segments = [
      seg(0, 0, 5, 'First sentence.   '),
      seg(1, 8, 12, 'Second.'),
    ];
    expect(buildParagraphBreaks(segments, 2)).toEqual([0, 1]);
  });

  test('multiple breaks across a longer transcript', () => {
    const segments = [
      seg(0, 0, 5, 'Intro.'),
      seg(1, 8, 12, 'Middle one.'),
      seg(2, 13, 18, 'More middle.'),
      seg(3, 21, 25, 'End.'),
    ];
    expect(buildParagraphBreaks(segments, 2)).toEqual([0, 1, 3]);
  });

  test('gap tuning: smaller threshold produces more breaks', () => {
    const segments = [
      seg(0, 0, 5, 'First.'),
      seg(1, 6.2, 10, 'Second.'),
      seg(2, 13, 18, 'Third.'),
    ];
    expect(buildParagraphBreaks(segments, 2)).toEqual([0, 2]);
    expect(buildParagraphBreaks(segments, 1)).toEqual([0, 1, 2]);
  });
});

describe('buildParagraphTexts', () => {
  test('single paragraph joins all segments', () => {
    const segments = [
      { text: ' Hello world.' },
      { text: ' How are you?' },
    ];
    expect(buildParagraphTexts(segments, [0])).toEqual([
      'Hello world. How are you?',
    ]);
  });

  test('two paragraphs partition the segments at the break', () => {
    const segments = [
      { text: ' First.' },
      { text: ' Still first.' },
      { text: ' Second.' },
      { text: ' Also second.' },
    ];
    expect(buildParagraphTexts(segments, [0, 2])).toEqual([
      'First. Still first.',
      'Second. Also second.',
    ]);
  });

  test('trims whitespace from each segment before joining', () => {
    const segments = [
      { text: '   Leading spaces.' },
      { text: 'Trailing spaces.   ' },
    ];
    expect(buildParagraphTexts(segments, [0])).toEqual([
      'Leading spaces. Trailing spaces.',
    ]);
  });

  test('output length matches breaks length', () => {
    const segments = [
      { text: 'a' },
      { text: 'b' },
      { text: 'c' },
      { text: 'd' },
    ];
    const result = buildParagraphTexts(segments, [0, 1, 3]);
    expect(result).toHaveLength(3);
    expect(result).toEqual(['a', 'b c', 'd']);
  });
});
