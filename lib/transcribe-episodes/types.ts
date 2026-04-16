import type { Transcript } from './transcript.js';

export interface FailResponse {
  ok: false;
  error: string;
}

// Shared shape consumed by paragraph, paragraphGroup, and summarize stages.
export type TailItem = Pick<
  Transcript,
  'episodeNumber' | 'path' | 'title' | 'description'
>;
