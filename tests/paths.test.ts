import { basename } from 'node:path';
import { describe, expect, test } from 'vitest';
import { episodePaths } from '@lib/transcribe-episodes/paths.js';

describe('episodePaths', () => {
  test('produces correct filenames for a basic episode', () => {
    const paths = episodePaths({ episodeNumber: 123, model: 'base' });
    expect(basename(paths.metadata)).toBe('123.metadata.json');
    expect(basename(paths.vad)).toBe('123.vad.json');
    expect(basename(paths.transcript)).toBe('123.transcript__base.json');
    expect(basename(paths.paragraph)).toBe('123.transcript__base.paragraph.json');
    expect(paths.summary).toBeUndefined();
  });

  test('zero-pads episode numbers to 3 digits', () => {
    const paths = episodePaths({ episodeNumber: 1, model: 'base' });
    expect(basename(paths.metadata)).toBe('001.metadata.json');
    expect(basename(paths.transcript)).toBe('001.transcript__base.json');
    expect(basename(paths.paragraph)).toBe('001.transcript__base.paragraph.json');
  });

  test('does not over-pad 3+ digit episode numbers', () => {
    const paths = episodePaths({ episodeNumber: 1234, model: 'base' });
    expect(basename(paths.metadata)).toBe('1234.metadata.json');
  });

  test('handleizes model name', () => {
    const paths = episodePaths({ episodeNumber: 1, model: 'gpt-4o' });
    expect(basename(paths.transcript)).toBe('001.transcript__gpt-4o.json');
    expect(basename(paths.paragraph)).toBe('001.transcript__gpt-4o.paragraph.json');
  });

  test('includes summary path when summaryModel is provided', () => {
    const paths = episodePaths({ episodeNumber: 42, model: 'base', summaryModel: 'gpt-4o' });
    expect(basename(paths.summary!)).toBe('042.transcript__base.summary__gpt-4o.json');
  });

  test('handleizes summary model name', () => {
    const paths = episodePaths({ episodeNumber: 42, model: 'base', summaryModel: 'gpt-4o' });
    expect(basename(paths.summary!)).toBe('042.transcript__base.summary__gpt-4o.json');
  });

  test('vad path is model-independent', () => {
    const a = episodePaths({ episodeNumber: 1, model: 'base' });
    const b = episodePaths({ episodeNumber: 1, model: 'large-v3' });
    expect(a.vad).toBe(b.vad);
    expect(basename(a.vad)).toBe('001.vad.json');
  });

  test('all paths share the same directory', () => {
    const paths = episodePaths({ episodeNumber: 1, model: 'base', summaryModel: 'gpt-4o' });
    const dirs = [paths.metadata, paths.vad, paths.transcript, paths.paragraph, paths.summary!].map(
      (p) => p.replace(basename(p), ''),
    );
    expect(new Set(dirs).size).toBe(1);
  });
});
