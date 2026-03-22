import { basename } from 'node:path';
import { describe, expect, test } from 'vitest';
import { episodePaths } from '@lib/paths.js';

describe('episodePaths', () => {
  test('produces correct filenames for a basic episode', () => {
    const paths = episodePaths({ episode: 123, model: 'base' });
    expect(basename(paths.meta)).toBe('123.episode-meta.json');
    expect(basename(paths.transcription)).toBe('123.transcription__base.json');
    expect(basename(paths.stats)).toBe('123.transcription__base.stats.json');
    expect(paths.summary).toBeNull();
  });

  test('zero-pads episode numbers to 3 digits', () => {
    const paths = episodePaths({ episode: 1, model: 'base' });
    expect(basename(paths.meta)).toBe('001.episode-meta.json');
    expect(basename(paths.transcription)).toBe('001.transcription__base.json');
    expect(basename(paths.stats)).toBe('001.transcription__base.stats.json');
  });

  test('does not over-pad 3+ digit episode numbers', () => {
    const paths = episodePaths({ episode: 1234, model: 'base' });
    expect(basename(paths.meta)).toBe('1234.episode-meta.json');
  });

  test('handelizes model name', () => {
    const paths = episodePaths({ episode: 1, model: 'gpt-4o' });
    expect(basename(paths.transcription)).toBe('001.transcription__gpt-4o.json');
  });

  test('includes summary path when summaryModel is provided', () => {
    const paths = episodePaths({ episode: 42, model: 'base', summaryModel: 'gpt-4o' });
    expect(basename(paths.summary!)).toBe('042.transcription__base.summary__gpt-4o.json');
  });

  test('handelizes summary model name', () => {
    const paths = episodePaths({ episode: 42, model: 'base', summaryModel: 'gpt-4o' });
    expect(basename(paths.summary!)).toBe('042.transcription__base.summary__gpt-4o.json');
  });

  test('all paths share the same directory', () => {
    const paths = episodePaths({ episode: 1, model: 'base', summaryModel: 'gpt-4o' });
    const dirs = [paths.meta, paths.transcription, paths.stats, paths.summary!].map(
      (p) => p.replace(basename(p), ''),
    );
    expect(new Set(dirs).size).toBe(1);
  });
});
