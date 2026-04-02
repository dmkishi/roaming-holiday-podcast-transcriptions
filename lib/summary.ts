import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FailResponse } from '@lib/types.js';
import { TranscriptFileSchema, type Transcript } from '@lib/transcript.js';
import { episodePaths } from '@lib/utils/paths.js';
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

// Expected response format of summary from OpenAI.
const SummaryResultSchema = z.object({
  summary: z.string(),
  sections: z.array(z.object({ title: z.string(), sentences: z.string() })),
  places: z.array(z.string()),
  keywords: z.array(z.string()),
});

const client = new OpenAI();

export async function promptSummary(
  transcript: Transcript,
  summaryModel: string,
  transcriptModel: string,
): Promise<SummaryResponse> {
  try {
    const { text } = TranscriptFileSchema.parse(
      JSON.parse(readFileSync(transcript.path, 'utf-8')),
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
      response_format: zodResponseFormat(SummaryResultSchema, 'episode_summary'),
    });

    const content = response.choices[0]?.message.content ?? '';
    if (content === '') {
      return {
        ok: false,
        error: 'Empty response from OpenAI',
      };
    }

    SummaryResultSchema.parse(JSON.parse(content));

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
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
