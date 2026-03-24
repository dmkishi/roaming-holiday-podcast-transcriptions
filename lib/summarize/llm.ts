import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { formatNumber } from '@lib/strings.js';
import { SYSTEM_PROMPT } from '@lib/config/prompts.js';

const SummaryResultSchema = z.object({
  summary: z.string(),
  sections: z.array(z.object({ title: z.string(), sentences: z.string() })),
  places: z.array(z.string()),
  keywords: z.array(z.string()),
});

export type SummaryResult = z.infer<typeof SummaryResultSchema>;

/**
 * Requests an OpenAI model to summarize a podcast episode transcript and
 * returns a structured object.
 */
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
    response_format: zodResponseFormat(SummaryResultSchema, 'episode_summary'),
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

  return SummaryResultSchema.parse(JSON.parse(content));
}
