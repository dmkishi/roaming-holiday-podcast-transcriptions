import OpenAI from 'openai';
import { formatNumber } from '@lib/strings.js';
import { SYSTEM_PROMPT } from '@lib/config/prompts.js';

export interface SummaryResult {
  summary: string;
  sections: { title: string; sentences: string }[];
  places: string[];
  keywords: string[];
}

const summarySchema = {
  name: 'episode_summary',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string' as const },
      sections: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const },
            sentences: { type: 'string' as const },
          },
          required: ['title', 'sentences'],
          additionalProperties: false,
        },
      },
      places: { type: 'array' as const, items: { type: 'string' as const } },
      keywords: { type: 'array' as const, items: { type: 'string' as const } },
    },
    required: ['summary', 'sections', 'places', 'keywords'],
    additionalProperties: false,
  },
};

export async function summarize(
  text: string,
  context: { title: string; description: string },
  model: string,
): Promise<SummaryResult> {
  const client = new OpenAI();

  const userMessage = [
    `"${context.title}"`,
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

  return JSON.parse(content) as SummaryResult;
}
