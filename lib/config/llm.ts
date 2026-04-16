export const DEFAULT_WHISPER_MODEL = 'base';
export const DEFAULT_SUMMARY_MODEL = 'gpt-4.1';

/**
 * The Whisper prompt is not instructional but provides context about the style
 * of speech patterns in the audio. Here, we provide proper nouns to condition
 * Whisper to recognize and spell them correctly.
 */
export const WHISPER_PROMPT = {
  // List names (places, brands, etc.) often mentioned in the podcast that may
  // be or are misheard or misspelled by the model.
  names: [
    '7-Eleven',
    'Ediya Coffee',
    'Moontan Trail',
    'Tim Hortons',
  ],
  basicInfo: '"Roaming Holiday" by Keith McNally of Fredericton, New Brunswick.',
} as const;

/**
 * - Generally, LLMs perform better when steered with positive examples instead
 *   of negative constraints.
 */
export const SUMMARY_PROMPT = `
  You are summarizing a podcast episode from "Roaming Holiday", a serialized
  travel podcast by Keith McNally. Given the episode title, description, and
  full transcript, compose a concise summary of the episode. Limit to 2
  sentences, maximum 30 words.

  - Refer to the speaker as "Keith" or "he/him".
  - Do not repeat the title of the podcast or the episode — focus on describing
    his journey, the content, and themes of the episode.
  - Mention specific place names but avoid listing them exhaustively.
`.trim();
