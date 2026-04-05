import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import { TranscriptFileSchema, SummaryFileSchema } from '@lib/shared/schemas.js';
import type { Transcript } from '@lib/transcribe-episodes/transcript.js';
import { episodePaths } from '@lib/transcribe-episodes/paths.js';
import { SUMMARY_PROMPT } from '@lib/config/llm.js';

export type SummaryInput = Pick<Transcript, 'episodeNumber' | 'path' | 'title' | 'description'>;

export type Summary =
  | {
      ok: true;
      status: 'generated';
      episodeNumber: number;
      path: string;
      stats: {
        tokenInput: number;
        tokenOutput: number;
      };
    }
  | {
      ok: true;
      status: 'alreadyExists';
      episodeNumber: number;
      path: string;
    };

export type SummaryResponse = FailResponse | Summary;

const client = new OpenAI();

export async function promptSummary(
  transcript: SummaryInput,
  summaryModel: string,
  transcriptModel: string,
  force: boolean,
): Promise<SummaryResponse> {
  try {
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

    if (!force && existsSync(path)) {
      return {
        ok: true,
        status: 'alreadyExists',
        episodeNumber: transcript.episodeNumber,
        path,
      };
    }

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

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);

    return {
      ok: true,
      status: 'generated',
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
