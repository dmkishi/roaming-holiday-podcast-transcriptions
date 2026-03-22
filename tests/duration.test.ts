import { describe, expect, test } from 'vitest';
import { parseDuration, fromSeconds } from '@lib/duration.js';

describe('parseDuration', () => {
  test('H:MM:SS', () => {
    const d = parseDuration('1:23:45');
    expect(d.seconds).toBe(5025);
    expect(d.timestamp).toBe('1:23:45');
    expect(d.human).toBe('1h 23m 45s');
  });

  test('MM:SS', () => {
    const d = parseDuration('23:45');
    expect(d.seconds).toBe(1425);
    expect(d.timestamp).toBe('0:23:45');
    expect(d.human).toBe('23m 45s');
  });

  test('bare seconds', () => {
    const d = parseDuration('45');
    expect(d.seconds).toBe(45);
    expect(d.timestamp).toBe('0:00:45');
    expect(d.human).toBe('45s');
  });

  test('zero-pads minutes and seconds in timestamp', () => {
    const d = parseDuration('1:3:5');
    expect(d.seconds).toBe(3785);
    expect(d.timestamp).toBe('1:03:05');
  });

  test('zero duration', () => {
    const d = parseDuration('0');
    expect(d.seconds).toBe(0);
    expect(d.timestamp).toBe('0:00:00');
    expect(d.human).toBe('0s');
  });

  test('exact hour', () => {
    const d = parseDuration('1:00:00');
    expect(d.seconds).toBe(3600);
    expect(d.human).toBe('1h 0m 0s');
  });
});

describe('fromSeconds', () => {
  test('formats large values', () => {
    const d = fromSeconds(7384);
    expect(d.timestamp).toBe('2:03:04');
    expect(d.human).toBe('2h 3m 4s');
  });

  test('under a minute', () => {
    const d = fromSeconds(30);
    expect(d.timestamp).toBe('0:00:30');
    expect(d.human).toBe('30s');
  });

  test('exact minutes', () => {
    const d = fromSeconds(120);
    expect(d.timestamp).toBe('0:02:00');
    expect(d.human).toBe('2m 0s');
  });

  test('zero', () => {
    const d = fromSeconds(0);
    expect(d.seconds).toBe(0);
    expect(d.timestamp).toBe('0:00:00');
    expect(d.human).toBe('0s');
  });

  test('roundtrips with parseDuration', () => {
    const original = '1:23:45';
    const d = parseDuration(original);
    const roundtripped = fromSeconds(d.seconds);
    expect(roundtripped.timestamp).toBe(original);
    expect(roundtripped.seconds).toBe(d.seconds);
    expect(roundtripped.human).toBe(d.human);
  });
});
