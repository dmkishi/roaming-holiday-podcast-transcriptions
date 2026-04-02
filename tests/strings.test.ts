import { describe, expect, test } from 'vitest';
import { formatDate, formatNumber, handleize, pluralize } from '@lib/utils/strings.js';

describe('formatDate', () => {
  test('formats a date as YYYY-MM-DD', () => {
    expect(formatDate(new Date('2025-03-15T12:00:00Z'))).toBe('2025-03-15');
  });

  test('zero-pads single-digit month and day', () => {
    expect(formatDate(new Date('2025-01-05T00:00:00Z'))).toBe('2025-01-05');
  });
});

describe('formatNumber', () => {
  test('adds commas to large numbers', () => {
    expect(formatNumber(1_234_567)).toBe('1,234,567');
  });

  test('leaves small numbers unchanged', () => {
    expect(formatNumber(42)).toBe('42');
  });

  test('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('handleize', () => {
  test('lowercases and replaces non-alphanumeric with hyphens', () => {
    expect(handleize('Hello World!')).toBe('hello-world');
  });

  test('collapses consecutive special characters', () => {
    expect(handleize('a---b')).toBe('a-b');
  });

  test('strips leading and trailing hyphens', () => {
    expect(handleize('--foo--')).toBe('foo');
  });

  test('handles a URL', () => {
    expect(handleize('https://example.com/path')).toBe('https-example-com-path');
  });

  test('returns empty string for all special characters', () => {
    expect(handleize('!@#$%')).toBe('');
  });
});

describe('pluralize', () => {
  test('returns singular for count of 1', () => {
    expect(pluralize(1, 'episode')).toBe('episode');
  });

  test('returns default plural for count of 0', () => {
    expect(pluralize(0, 'episode')).toBe('episodes');
  });

  test('returns default plural for count > 1', () => {
    expect(pluralize(5, 'episode')).toBe('episodes');
  });

  test('uses custom plural when provided', () => {
    expect(pluralize(2, 'index', 'indices')).toBe('indices');
  });

  test('uses custom singular when count is 1', () => {
    expect(pluralize(1, 'index', 'indices')).toBe('index');
  });
});
