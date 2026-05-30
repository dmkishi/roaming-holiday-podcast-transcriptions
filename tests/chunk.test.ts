import { describe, expect, test } from 'vitest';
import { findGapsOverThreshold } from '@lib/transcribe-episodes/audioGaps.js';
import {
  chooseCutPoints,
  mergeChunkTranscripts,
  type CutPointOptions,
} from '@lib/transcribe-episodes/audioChunk.js';

const defaultOpts: CutPointOptions = {
  targetChunkMinutes: 15,
  initialWindowMinutes: 2,
  maxWindowMinutes: 6,
};

// ---------------------------------------------------------------------------
// gapsFromSpeech
// ---------------------------------------------------------------------------

describe('gapsFromSpeech', () => {
  test('leading silence before first speech', () => {
    const speech = [{ start: 5, end: 10 }];
    const gaps = findGapsOverThreshold(speech, 10, 0.4);
    expect(gaps).toEqual([{ start: 0, end: 5, duration: 5 }]);
  });

  test('trailing silence after last speech', () => {
    const speech = [{ start: 0, end: 5 }];
    const gaps = findGapsOverThreshold(speech, 10, 0.4);
    expect(gaps).toEqual([{ start: 5, end: 10, duration: 5 }]);
  });

  test('gap between two speech intervals', () => {
    const speech = [
      { start: 0, end: 10 },
      { start: 13, end: 20 },
    ];
    const gaps = findGapsOverThreshold(speech, 20, 0.4);
    expect(gaps).toEqual([{ start: 10, end: 13, duration: 3 }]);
  });

  test('leading, middle, and trailing gaps', () => {
    const speech = [
      { start: 2, end: 5 },
      { start: 8, end: 12 },
    ];
    const gaps = findGapsOverThreshold(speech, 15, 0.4);
    expect(gaps).toEqual([
      { start: 0, end: 2, duration: 2 },
      { start: 5, end: 8, duration: 3 },
      { start: 12, end: 15, duration: 3 },
    ]);
  });

  test('filters gaps smaller than minGapSeconds', () => {
    const speech = [
      { start: 0, end: 10 },
      { start: 10.2, end: 20 },
      { start: 22, end: 30 },
    ];
    const gaps = findGapsOverThreshold(speech, 30, 0.4);
    expect(gaps).toEqual([{ start: 20, end: 22, duration: 2 }]);
  });

  test('no speech at all returns full duration as gap', () => {
    const gaps = findGapsOverThreshold([], 60, 0.4);
    expect(gaps).toEqual([{ start: 0, end: 60, duration: 60 }]);
  });

  test('touching speech intervals produce no gap', () => {
    const speech = [
      { start: 0, end: 5 },
      { start: 5, end: 10 },
    ];
    const gaps = findGapsOverThreshold(speech, 10, 0.4);
    expect(gaps).toEqual([]);
  });

  test('speech covers entire duration', () => {
    const speech = [{ start: 0, end: 60 }];
    const gaps = findGapsOverThreshold(speech, 60, 0.4);
    expect(gaps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// chooseCutPoints
// ---------------------------------------------------------------------------

describe('chooseCutPoints', () => {
  test('file shorter than target returns [0, totalDuration]', () => {
    const cuts = chooseCutPoints([], 600, defaultOpts);
    expect(cuts).toEqual([0, 600]);
  });

  test('file exactly at target returns [0, totalDuration]', () => {
    const cuts = chooseCutPoints([], 900, defaultOpts);
    expect(cuts).toEqual([0, 900]);
  });

  test('picks midpoint of gap near target', () => {
    const gaps = [{ start: 870, end: 930, duration: 60 }];
    const cuts = chooseCutPoints(gaps, 1800, defaultOpts);
    expect(cuts).toEqual([0, 900, 1800]);
  });

  test('prefers longest gap within window', () => {
    // Small gap near target
    // Large gap near target
    const gaps = [
      { start: 880, end: 885, duration: 5 },
      { start: 850, end: 870, duration: 20 },
    ];
    const cuts = chooseCutPoints(gaps, 1800, defaultOpts);
    expect(cuts[1]).toBe(860);
  });

  test('widens search window when no gap in initial window', () => {
    const gaps = [{ start: 598, end: 602, duration: 4 }];
    const cuts = chooseCutPoints(gaps, 1800, defaultOpts);
    expect(cuts[1]).toBe(600);
  });

  test('hard-cuts at target when no gap found in max window', () => {
    const cuts = chooseCutPoints([], 1800, defaultOpts);
    expect(cuts).toEqual([0, 900, 1800]);
  });

  test('multiple cut points for a long file', () => {
    const gaps = [
      { start: 895, end: 905, duration: 10 },
      { start: 1795, end: 1805, duration: 10 },
      { start: 2695, end: 2705, duration: 10 },
    ];
    const cuts = chooseCutPoints(gaps, 3600, defaultOpts);
    expect(cuts[0]).toBe(0);
    expect(cuts.at(-1)).toBe(3600);
    // 0, ~900, ~1800, ~2700, 3600
    expect(cuts.length).toBe(5);
  });

  test('does not add cut point that leaves a tiny tail', () => {
    const gaps = [{ start: 898, end: 902, duration: 4 }];
    const cuts = chooseCutPoints(gaps, 960, defaultOpts);
    expect(cuts).toEqual([0, 960]);
  });
});

// ---------------------------------------------------------------------------
// mergeChunkTranscripts
// ---------------------------------------------------------------------------

describe('mergeChunkTranscripts', () => {
  test('offsets timestamps by chunk start', () => {
    const chunks = [
      {
        startSeconds: 0,
        json: {
          text: 'Hello.',
          segments: [{ id: 0, start: 0, end: 5, text: ' Hello.', words: [] }],
        },
      },
      {
        startSeconds: 900,
        json: {
          text: 'World.',
          segments: [{ id: 0, start: 0, end: 3, text: ' World.', words: [] }],
        },
      },
    ];

    const merged = mergeChunkTranscripts(chunks);
    expect(merged.segments).toEqual([
      { id: 0, start: 0, end: 5, text: ' Hello.', words: [] },
      { id: 1, start: 900, end: 903, text: ' World.', words: [] },
    ]);
  });

  test('assigns sequential ids across chunks', () => {
    const chunks = [
      {
        startSeconds: 0,
        json: {
          text: 'A',
          segments: [
            { id: 0, start: 0, end: 1, text: ' A', words: [] },
            { id: 1, start: 1, end: 2, text: ' B', words: [] },
          ],
        },
      },
      {
        startSeconds: 100,
        json: {
          text: 'C',
          segments: [
            { id: 0, start: 0, end: 1, text: ' C', words: [] },
          ],
        },
      },
    ];

    const merged = mergeChunkTranscripts(chunks);
    expect(merged.segments.map((s) => s.id)).toEqual([0, 1, 2]);
  });

  test('concatenates text from all chunks', () => {
    const chunks = [
      { startSeconds: 0, json: { text: ' First chunk.', segments: [] } },
      { startSeconds: 900, json: { text: ' Second chunk.', segments: [] } },
    ];
    const merged = mergeChunkTranscripts(chunks);
    expect(merged.text).toBe('First chunk. Second chunk.');
  });

  test('handles chunk with no segments', () => {
    const chunks = [
      {
        startSeconds: 0,
        json: { text: 'Hello.', segments: [] },
      },
      {
        startSeconds: 900,
        json: {
          text: 'World.',
          segments: [{ id: 0, start: 0, end: 3, text: ' World.', words: [] }],
        },
      },
    ];
    const merged = mergeChunkTranscripts(chunks);
    expect(merged.segments).toHaveLength(1);
    expect(merged.segments[0]!.id).toBe(0);
    expect(merged.segments[0]!.start).toBe(900);
  });

  test('handles chunk with missing segments field', () => {
    const chunks = [
      { startSeconds: 0, json: { text: 'Only text.' } },
    ];
    const merged = mergeChunkTranscripts(chunks);
    expect(merged.text).toBe('Only text.');
    expect(merged.segments).toEqual([]);
  });

  test('single chunk passes through correctly', () => {
    const chunks = [
      {
        startSeconds: 0,
        json: {
          text: 'Single.',
          segments: [
            { id: 0, start: 0, end: 2, text: ' Single.', words: [] },
          ],
        },
      },
    ];
    const merged = mergeChunkTranscripts(chunks);
    expect(merged.text).toBe('Single.');
    expect(merged.segments).toEqual([
      { id: 0, start: 0, end: 2, text: ' Single.', words: [] },
    ]);
  });

  test('offsets word timestamps by chunk start', () => {
    const chunks = [
      {
        startSeconds: 0,
        json: {
          text: 'Hello there.',
          segments: [{
            id: 0,
            start: 0,
            end: 5,
            text: ' Hello there.',
            words: [
              { text: ' Hello', start: 0.25, end: 0.75, confidence: 0.9 },
              { text: ' there.', start: 0.75, end: 1.5, confidence: 0.8 },
            ],
          }],
        },
      },
      {
        startSeconds: 900,
        json: {
          text: 'World now.',
          segments: [{
            id: 0,
            start: 0,
            end: 3,
            text: ' World now.',
            words: [
              { text: ' World', start: 0.5, end: 1.25, confidence: 0.95 },
              { text: ' now.', start: 1.5, end: 2.75, confidence: 0.7 },
            ],
          }],
        },
      },
    ];

    const merged = mergeChunkTranscripts(chunks);
    // First chunk (offset 0): word times unchanged.
    expect(merged.segments[0]!.words).toEqual([
      { text: ' Hello', start: 0.25, end: 0.75, confidence: 0.9 },
      { text: ' there.', start: 0.75, end: 1.5, confidence: 0.8 },
    ]);
    // Second chunk (offset 900): word times rebased, confidence untouched.
    expect(merged.segments[1]!.words).toEqual([
      { text: ' World', start: 900.5, end: 901.25, confidence: 0.95 },
      { text: ' now.', start: 901.5, end: 902.75, confidence: 0.7 },
    ]);
  });

});
