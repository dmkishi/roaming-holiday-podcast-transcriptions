import OpenAI from 'openai';
import { readTranscript, writeSummary } from '@lib/shared/artifacts.js';
import type { FailResponse, TailItem } from '@lib/transcribe-episodes/types.js';
import { SUMMARY_PROMPT } from '@lib/config/llm.js';

export interface Summary {
  ok: true;
  episodeNumber: number;
  path: string;
  stats: {
    tokenInput: number;
    tokenOutput: number;
  };
}

export type SummaryResponse = FailResponse | Summary;

const client = new OpenAI();

export async function promptSummary(
  transcript: TailItem,
  summaryModel: string,
): Promise<SummaryResponse> {
  try {
    const { text: transcriptionText } = readTranscript(transcript.episodeNumber);

    if (!transcriptionText) {
      return {
        ok: false,
        error: 'Transcript text is empty',
      };
    }

    const response = await client.responses.create({
      model: summaryModel,
      instructions: SUMMARY_PROMPT,
      input: [
        `Title: "${transcript.title}"`,
        `Description: ${transcript.description}`,
        `Transcript: ${transcriptionText}`,
      ].join('\n'),
    });

    if (response.output_text === '') {
      return {
        ok: false,
        error: 'Empty response from OpenAI',
      };
    }

    const summaryPath = writeSummary(transcript.episodeNumber, response.output_text);

    return {
      ok: true,
      episodeNumber: transcript.episodeNumber,
      path: summaryPath,
      stats: {
        tokenInput: response.usage?.input_tokens ?? 0,
        tokenOutput: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
