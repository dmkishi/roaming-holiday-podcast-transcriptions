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

interface TranscriptStats {
  characterCount: number;
  wordCount: number;
  meanAvgLogProb: number; // Model confidence: closer to 0 = higher confidence
  lowConfidencePercent: number; // Percent of audio the model is NOT confident
}

const LOW_CONFIDENCE_THRESHOLD = -1.0;

export function computeTranscriptStats(
  transcript: Transcript
): TranscriptStats {
  const text = transcript.text.trim();
  const segments = transcript.segments;
  const segmentCount = segments.length;
  const sumAvgLogProb = segments.reduce((sum, s) => sum + s.avg_logprob, 0);
  const lowConfidenceCount = segments.filter((s) => s.avg_logprob < LOW_CONFIDENCE_THRESHOLD).length;

  return {
    characterCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    meanAvgLogProb: segmentCount > 0 ? sumAvgLogProb / segmentCount : 0,
    lowConfidencePercent: segmentCount > 0 ? (lowConfidenceCount / segmentCount) * 100 : 0,
  };
}
