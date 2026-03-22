import OpenAI from 'openai';
import { formatNumber } from '../strings.js';

export interface SummaryResult {
  episodeNumber: number;
  summary: string;
  keywords: string[];
  places: string[];
}

const SYSTEM_PROMPT = `
You are analyzing a transcript from "Roaming Holiday", a travel podcast by Keith
McNally.

Given the episode title, description, and full transcript text, extract:
1. **summary**: A concise 2-3 sentence summary of the episode.
  - Refer to the speaker as "The host" or "he/him".
  - Do not repeat the title of the podcast or the episode — focus on describing
    the content and themes of the episode.
  - It is encouraged to mention specific plane names but avoid listing them
    exhaustively.
2. **keywords**: 5–10 relevant keywords or short phrases capturing the main
   topics discussed.
   - This is a travel podcast so avoid generic keywords like "travel",
     "adventure", or "culture".
   - Do not include place names, instead they should go in the "places" field.
3. **places**: All place names mentioned (cities, countries, trails, landmarks,
   businesses, etc.).

Return only the JSON object with these three fields.`;

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
