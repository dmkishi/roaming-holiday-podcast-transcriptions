import { describe, expect, test } from 'vitest';
import { stripSelfLink } from '#lib/shared/stripSelfLink.ts';

const SITE = 'https://example.com/site';

describe('stripSelfLink', () => {
  test('strips a labelled link from the tail', () => {
    expect(
      stripSelfLink(
        `Areas discussed: Tokyo. Transcripts: ${SITE}/`,
        SITE,
      ),
    ).toBe('Areas discussed: Tokyo.');
  });

  test('strips a bare URL with no label', () => {
    expect(stripSelfLink(`Areas discussed: Tokyo. ${SITE}/`, SITE)).toBe(
      'Areas discussed: Tokyo.',
    );
  });

  test('strips the URL without its trailing slash', () => {
    expect(stripSelfLink(`Areas discussed: Tokyo. ${SITE}`, SITE)).toBe(
      'Areas discussed: Tokyo.',
    );
  });

  test('leaves a description with no link untouched', () => {
    expect(stripSelfLink('Areas discussed: Tokyo.', SITE)).toBe(
      'Areas discussed: Tokyo.',
    );
  });

  test('treats the base URL as a literal, not a pattern', () => {
    const tricky = 'https://example.com/a?b=1';
    expect(stripSelfLink(`Tokyo. Transcripts: ${tricky}`, tricky)).toBe('Tokyo.');
    // The metacharacters must not match some other string they describe.
    expect(stripSelfLink('https://example.com/ab=1', tricky)).toBe(
      'https://example.com/ab=1',
    );
  });

  test('strips the real link when baseUrl is omitted', () => {
    expect(
      stripSelfLink(
        'Areas discussed: Tokyo. Transcripts: https://dmkishi.github.io/roaming-holiday-podcast-transcriptions/',
      ),
    ).toBe('Areas discussed: Tokyo.');
  });
});
