import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FailResponse } from '@lib/transcribe/types.js';
import { TranscriptFileSchema, SummaryFileSchema } from '@lib/shared/schemas.js';
import type { Transcript } from '@lib/transcribe/transcript.js';
import { episodePaths } from '@lib/transcribe/paths.js';
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
  transcript: Transcript,
  summaryModel: string,
  transcriptModel: string,
): Promise<SummaryResponse> {
  try {
    const { text } = TranscriptFileSchema.parse(
      JSON.parse(readFileSync(transcript.path, 'utf8')),
    );

    if (!text) {
      return {
        ok: false,
        error: 'Transcript text is empty',
      };
    }

    const userMessage = [
      `"${transcript.title}"`,
      '',
      `Description: ${transcript.description}`,
      '',
      'Transcript:',
      text,
    ].join('\n');

    const response = await client.chat.completions.create({
      model: summaryModel,
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: zodResponseFormat(SummaryFileSchema, 'episode_summary'),
    });

    const content = response.choices[0]?.message.content ?? '';
    if (content === '') {
      return {
        ok: false,
        error: 'Empty response from OpenAI',
      };
    }

    SummaryFileSchema.parse(JSON.parse(content));

    const { summary: path = '' } = episodePaths({
      episodeNumber: transcript.episodeNumber,
      model: transcriptModel,
      summaryModel,
    });

    if (path === '') {
      return {
        ok: false,
        error: 'Could not derive summary path',
      };
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);

    return {
      ok: true,
      episodeNumber: transcript.episodeNumber,
      path,
      stats: {
        tokenInput: response.usage?.prompt_tokens ?? 0,
        tokenOutput: response.usage?.completion_tokens ?? 0,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
