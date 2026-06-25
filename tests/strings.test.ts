import { describe, expect, test } from 'vitest';
import {
  formatDate,
  formatLongDate,
  formatNumber,
  handleize,
  pluralize,
} from '#lib/shared/strings.ts';

describe('formatDate', () => {
  test('formats a date as YYYY-MM-DD', () => {
    expect(formatDate(new Date('2025-03-15T12:00:00Z'))).toBe('2025-03-15');
  });

  test('zero-pads single-digit month and day', () => {
    expect(formatDate(new Date('2025-01-05T00:00:00Z'))).toBe('2025-01-05');
  });
});

describe('formatLongDate', () => {
  test('formats an ISO datetime as long-form US English', () => {
    expect(formatLongDate('2026-04-01T11:42:57.000Z')).toBe('April 1, 2026');
  });

  test('formats a date-only string without shifting the day', () => {
    expect(formatLongDate('2026-04-04')).toBe('April 4, 2026');
  });

  test('renders in UTC regardless of the host timezone', () => {
    const original = process.env['TZ'];
    try {
      // A western timezone would render UTC midnight as the previous day...
      process.env['TZ'] = 'America/Los_Angeles';
      expect(formatLongDate('2026-04-04')).toBe('April 4, 2026');
      // ...and a far-eastern one as the next day, if not pinned to UTC.
      process.env['TZ'] = 'Pacific/Kiritimati';
      expect(formatLongDate('2026-04-01T11:42:57.000Z')).toBe('April 1, 2026');
    } finally {
      process.env['TZ'] = original;
    }
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
