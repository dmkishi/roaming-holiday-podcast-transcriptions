export const DEFAULT_WHISPER_MODEL = 'base';
export const DEFAULT_SUMMARY_MODEL = 'gpt-4.1';

/**
 * The Whisper prompt is not instructional but provides context about the style
 * of speech patterns in the audio. Here, we provide proper nouns to condition
 * Whisper to recognize and spell them correctly.
 */
export const WHISPER_PROMPT = {
  // List place names often mentioned in the podcast that may be or are misheard
  // or misspelled by the model.
  placeNames: '7-Eleven, Ediya Coffee, Moontan Trail, Tim Hortons.',
  basicInfo: '"Roaming Holiday" by Keith McNally of Fredericton, New Brunswick.',
} as const;

/**
 * - Generally, LLMs perform better when steered with positive examples instead
 *   of negative constraints.
 */
export const SUMMARY_PROMPT = `
  You are analyzing a transcript from "Roaming Holiday", a travel podcast by
  Keith McNally.

  Given the episode title, description, and full transcript text, extract:
  1. **summary**: A concise summary of the episode. Limit to 2 sentences,
     maximum 30 words.
     - Refer to the speaker as "Keith" or "he/him".
     - Do not repeat the title of the podcast or the episode — focus on
       describing the content and themes of the episode.
     - Mention specific place names but avoid listing them exhaustively.

  2. **sections**: Break the episode into 1–5 sections principally by changes in
     the locale or the time of recording.
     - For each section, provide:
       - **title**: A concise title for the section (1–8 words). Keep the
         language simple.
       - **sentences**: The first 2 sentences of the section's content, VERBATIM.
         Do not change the spelling or punctuation, copy it exactly as it is in
         the transcript.
     - The first section should always start from the beginning of the
       transcript.
     - If he ends the episode with a closing statement, that should be its own
       section.
     - Return sections as an array in transcript order.

  3. **places**: All place names mentioned (cities, countries, trails, landmarks,
     businesses, etc.)

  4. **keywords**: 3–5 relevant keywords or short phrases capturing the main
     topics discussed.
     - Prefer single words with a maximum of 2 words.
     - Do not include place names.
     - This is a travel podcast so avoid generic keywords like:
       - "travel",
       - "adventure"
       - "walking"
       - "hiking"
       - "weather"
       - "local culture"
       - "urban exploration".

  Return only the JSON object with these four fields.
`.trim();
