import { basename } from 'node:path';
import { describe, expect, test } from 'vitest';
import { paths } from '@lib/shared/artifacts.js';

describe('paths', () => {
  test('produces correct filenames for a basic episode', () => {
    const p = paths(123);
    expect(basename(p.metadata)).toBe('123.metadata.json');
    expect(basename(p.gaps)).toBe('123.audio-gaps.json');
    expect(basename(p.transcript)).toBe('123.transcript.json');
    expect(basename(p.paragraph)).toBe('123.transcript.paragraph.json');
  });

  test('zero-pads episode numbers to 3 digits', () => {
    const p = paths(1);
    expect(basename(p.metadata)).toBe('001.metadata.json');
    expect(basename(p.transcript)).toBe('001.transcript.json');
    expect(basename(p.paragraph)).toBe('001.transcript.paragraph.json');
  });

  test('does not over-pad 3+ digit episode numbers', () => {
    const p = paths(1_234);
    expect(basename(p.metadata)).toBe('1234.metadata.json');
  });

  test('all paths share the same directory', () => {
    const p = paths(1);
    const dirs = [p.metadata, p.gaps, p.transcript, p.paragraph]
      .map((x) => x.replace(basename(x), ''));
    expect(new Set(dirs).size).toBe(1);
  });
});
