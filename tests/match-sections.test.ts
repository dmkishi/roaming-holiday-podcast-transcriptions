import { describe, expect, it } from 'vitest';
import { matchSections } from '@lib/build-www/match-sections.js';

describe('matchSections', () => {
  it('returns empty result for empty inputs', () => {
    expect(matchSections([], [])).toEqual({ sections: [], unmatched: [] });
    expect(matchSections([{ title: 'A', sentences: 'text' }], [])).toEqual({ sections: [], unmatched: [] });
    expect(matchSections([], [{ id: 0, text: 'text' }])).toEqual({ sections: [], unmatched: [] });
  });

  it('matches exact text in first segment', () => {
    const sections = [{ title: 'Intro', sentences: 'Hello world' }];
    const segments = [
      { id: 0, text: 'Hello world, this is a test.' },
      { id: 1, text: 'Second segment here.' },
    ];

    const result = matchSections(sections, segments);
    expect(result.sections).toEqual([{ title: 'Intro', segmentIndex: 0 }]);
    expect(result.unmatched).toEqual([]);
  });

  it('matches text spanning multiple segments', () => {
    const sections = [{ title: 'Mid', sentences: 'end of one start of two' }];
    const segments = [
      { id: 0, text: 'Unrelated intro text.' },
      { id: 1, text: 'This is the end of one' },
      { id: 2, text: 'start of two and more.' },
      { id: 3, text: 'Final segment.' },
    ];

    const result = matchSections(sections, segments);
    expect(result.sections).toEqual([{ title: 'Mid', segmentIndex: 1 }]);
    expect(result.unmatched).toEqual([]);
  });

  it('handles minor punctuation differences via normalization', () => {
    const sections = [{ title: 'Test', sentences: "Well, shoot. I am here!" }];
    const segments = [
      { id: 0, text: ' Well, shoot. I am here.' },
    ];

    const result = matchSections(sections, segments);
    expect(result.sections).toEqual([{ title: 'Test', segmentIndex: 0 }]);
    expect(result.unmatched).toEqual([]);
  });

  it('matches multiple sections in order', () => {
    const sections = [
      { title: 'First', sentences: 'Alpha text' },
      { title: 'Second', sentences: 'Beta text' },
      { title: 'Third', sentences: 'Gamma text' },
    ];
    const segments = [
      { id: 0, text: 'Alpha text here.' },
      { id: 1, text: 'More content.' },
      { id: 2, text: 'Beta text follows.' },
      { id: 3, text: 'Even more.' },
      { id: 4, text: 'Gamma text at end.' },
    ];

    const result = matchSections(sections, segments);
    expect(result.sections).toEqual([
      { title: 'First', segmentIndex: 0 },
      { title: 'Second', segmentIndex: 2 },
      { title: 'Third', segmentIndex: 4 },
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it('uses Dice fallback for fuzzy matches', () => {
    const sections = [{
      title: 'Fuzzy',
      sentences: 'The quick brown fox jumped over the lazy sleeping dog',
    }];
    const segments = [
      { id: 0, text: 'Unrelated stuff here.' },
      { id: 1, text: 'The quick brown fox jumps over the lazy dog' },
    ];

    const result = matchSections(sections, segments);
    expect(result.sections).toEqual([{ title: 'Fuzzy', segmentIndex: 1 }]);
    expect(result.unmatched).toEqual([]);
  });

  it('reports unmatched section titles when both strategies fail', () => {
    const sections = [{
      title: 'Ghost',
      sentences: 'totally absent phrase nowhere to be found',
    }];
    const segments = [
      { id: 0, text: 'Unrelated alpha.' },
      { id: 1, text: 'Unrelated beta.' },
    ];

    const result = matchSections(sections, segments);
    expect(result.sections).toEqual([{ title: 'Ghost', segmentIndex: 0 }]);
    expect(result.unmatched).toEqual(['Ghost']);
  });
});
