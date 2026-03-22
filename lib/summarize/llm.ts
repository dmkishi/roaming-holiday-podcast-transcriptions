import OpenAI from 'openai';
import { formatNumber } from '../strings.js';
import { SYSTEM_PROMPT } from '../config/prompts.js';

export interface SummaryResult {
  episodeNumber: number;
  summary: string;
  keywords: string[];
  places: string[];
}

const summarySchema = {
  name: 'episode_summary',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string' as const },
      keywords: { type: 'array' as const, items: { type: 'string' as const } },
      places: { type: 'array' as const, items: { type: 'string' as const } },
    },
    required: ['summary', 'keywords', 'places'],
    additionalProperties: false,
  },
};

export async function summarize(
  text: string,
  context: { episodeNumber: number; title: string; description: string },
  model = 'gpt-4o',
): Promise<SummaryResult> {
  const client = new OpenAI();

  const userMessage = [
    `Episode #${context.episodeNumber}: "${context.title}"`,
    '',
    `Description: ${context.description}`,
    '',
    'Transcript:',
    text,
  ].join('\n');

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: summarySchema,
    },
  });

  if (response.usage) {
    const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
    console.log(
      `  LLM usage: ${formatNumber(prompt_tokens)} prompt + ${formatNumber(completion_tokens)} completion = ${formatNumber(total_tokens)} total tokens`,
    );
  }

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  const parsed = JSON.parse(content) as { summary: string; keywords: string[]; places: string[] };

  return {
    episodeNumber: context.episodeNumber,
    ...parsed,
  };
}
