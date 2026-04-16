import OpenAI from 'openai';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import { TranscriptFileSchema } from '@lib/shared/schemas.js';
import type { Transcript } from '@lib/transcribe-episodes/transcript.js';
import { episodePaths } from '@lib/transcribe-episodes/paths.js';
import { SUMMARY_PROMPT } from '@lib/config/llm.js';

export type SummaryInput = Pick<Transcript, 'episodeNumber' | 'path' | 'title' | 'description'>;

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
  transcript: SummaryInput,
  summaryModel: string,
): Promise<SummaryResponse> {
  try {
    const { summary: summaryPath } = episodePaths(transcript.episodeNumber);
    const { text: transcriptionText } = TranscriptFileSchema.parse(
      JSON.parse(readFileSync(transcript.path, 'utf8')),
    );

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

    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, response.output_text);

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
