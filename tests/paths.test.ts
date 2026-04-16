import { basename } from 'node:path';
import { describe, expect, test } from 'vitest';
import { episodePaths } from '@lib/transcribe-episodes/paths.js';

describe('episodePaths', () => {
  test('produces correct filenames for a basic episode', () => {
    const paths = episodePaths({ episodeNumber: 123 });
    expect(basename(paths.metadata)).toBe('123.metadata.json');
    expect(basename(paths.vad)).toBe('123.vad.json');
    expect(basename(paths.transcript)).toBe('123.transcript.json');
    expect(basename(paths.paragraph)).toBe('123.transcript.paragraph.json');
    expect(paths.summary).toBeUndefined();
  });

  test('zero-pads episode numbers to 3 digits', () => {
    const paths = episodePaths({ episodeNumber: 1 });
    expect(basename(paths.metadata)).toBe('001.metadata.json');
    expect(basename(paths.transcript)).toBe('001.transcript.json');
    expect(basename(paths.paragraph)).toBe('001.transcript.paragraph.json');
  });

  test('does not over-pad 3+ digit episode numbers', () => {
    const paths = episodePaths({ episodeNumber: 1234 });
    expect(basename(paths.metadata)).toBe('1234.metadata.json');
  });

  test('includes summary path when summaryModel is provided', () => {
    const paths = episodePaths({ episodeNumber: 42, summaryModel: 'gpt-4o' });
    expect(basename(paths.summary!)).toBe('042.transcript.summary__gpt-4o.txt');
  });

  test('handleizes summary model name', () => {
    const paths = episodePaths({ episodeNumber: 42, summaryModel: 'GPT 4o' });
    expect(basename(paths.summary!)).toBe('042.transcript.summary__gpt-4o.txt');
  });

  test('all paths share the same directory', () => {
    const paths = episodePaths({ episodeNumber: 1, summaryModel: 'gpt-4o' });
    const dirs = [paths.metadata, paths.vad, paths.transcript, paths.paragraph, paths.summary!].map(
      (p) => p.replace(basename(p), ''),
    );
    expect(new Set(dirs).size).toBe(1);
  });
});
