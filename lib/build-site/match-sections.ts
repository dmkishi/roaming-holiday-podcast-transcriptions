import type { ResolvedSection } from '@lib/build-site/types.js';

interface SummarySection {
  title: string;
  sentences: string;
}

interface Segment {
  id: number;
  text: string;
}

/**
 * Match summary section sentences to transcript segment indices using
 * normalized substring search with Dice coefficient fallback.
 */
export function matchSections(
  sections: SummarySection[],
  segments: Segment[],
): ResolvedSection[] {
  if (sections.length === 0 || segments.length === 0) return [];

  const normalizedSegments = segments.map((s) => normalize(s.text));
  const results: ResolvedSection[] = [];
  let searchFrom = 0;

  for (const section of sections) {
    const needle = normalize(section.sentences);
    let matchIndex = findSubstringMatch(needle, normalizedSegments, searchFrom);

    if (matchIndex === -1) {
      matchIndex = findDiceMatch(needle, normalizedSegments, searchFrom);
    }

    if (matchIndex === -1) {
      matchIndex = searchFrom;
      console.warn(`[match-sections] No match for "${section.title}", using segment ${matchIndex}`);
    }

    results.push({ title: section.title, segmentIndex: matchIndex });
    searchFrom = matchIndex + 1;
  }

  return results;
}

function normalize(text: string): string {
  return text.toLowerCase().replaceAll(/[^\w\s]/g, '').replaceAll(/\s+/g, ' ').trim();
}

/**
 * Search for the needle as a substring within sliding windows of concatenated
 * segment text, starting from `fromIndex`. Returns the specific segment where
 * the match begins, not just the window start.
 */
function findSubstringMatch(
  needle: string,
  normalizedSegments: string[],
  fromIndex: number,
): number {
  const windowSize = 5;

  for (let i = fromIndex; i < normalizedSegments.length; i++) {
    const windowSegments = normalizedSegments.slice(i, i + windowSize);
    const window = windowSegments.join(' ');
    const matchPos = window.indexOf(needle);

    if (matchPos !== -1) {
      // Find which segment the match starts in.
      let charOffset = 0;
      for (let j = 0; j < windowSegments.length; j++) {
        const segEnd = charOffset + windowSegments[j]!.length;
        if (matchPos < segEnd) return i + j;
        // Account for the space inserted by join.
        charOffset = segEnd + 1;
      }
      return i;
    }
  }

  return -1;
}

/**
 * Find the segment with the highest Dice coefficient similarity above the
 * threshold.
 */
function findDiceMatch(
  needle: string,
  normalizedSegments: string[],
  fromIndex: number,
): number {
  const threshold = 0.6;
  const windowSize = 5;
  const needleBigrams = bigrams(needle);
  let bestIndex = -1;
  let bestScore = threshold;

  for (let i = fromIndex; i < normalizedSegments.length; i++) {
    const window = normalizedSegments
      .slice(i, i + windowSize)
      .join(' ');
    const score = diceCoefficient(needleBigrams, bigrams(window));

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function bigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    set.add(text.slice(i, i + 2));
  }
  return set;
}

function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const bigram of a) {
    if (b.has(bigram)) intersection++;
  }

  return (2 * intersection) / (a.size + b.size);
}
