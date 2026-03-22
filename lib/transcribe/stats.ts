interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface Transcription {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
}

interface TranscriptionStats {
  characterCount: number;
  wordCount: number;
  meanAvgLogProb: number; // Model confidence: closer to 0 = higher confidence
  lowConfidencePercent: number; // Percent of audio the model is NOT confident
}

const LOW_CONFIDENCE_THRESHOLD = -1.0;

export function computeTranscriptionStats(
  transcription: Transcription
): TranscriptionStats {
  const text = transcription.text.trim();
  const segments = transcription.segments;
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
