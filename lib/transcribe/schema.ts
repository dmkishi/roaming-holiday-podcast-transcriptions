import { z } from 'zod';

const TranscriptSegmentSchema = z.object({
  id: z.number(),
  seek: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  tokens: z.array(z.number()),
  temperature: z.number(),
  avg_logprob: z.number(),
  compression_ratio: z.number(),
  no_speech_prob: z.number(),
});

export const TranscriptSchema = z.object({
  text: z.string(),
  segments: z.array(TranscriptSegmentSchema),
  language: z.string(),
});

export type Transcript = z.infer<typeof TranscriptSchema>;
