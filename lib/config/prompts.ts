/**
 * The Whisper prompt is not instructional but provides context about the style
 * speech patterns of the audio. Here, we include proper nouns and names to help
 * Whisper recognize and spell them correctly.
 */
export const BASE_PROMPT = `
  "Roaming Holiday" is a travel podcast by Keith McNally of Fredericton, New
  Brunswick. He goes to: 7-Eleven, Ximen, Tim Hortons.
`.trim();

/**
 * - Generally, LLMs perform better when steered with positive examples instead
 *   of negative constraints.
 */
export const SYSTEM_PROMPT = `
  You are analyzing a transcript from "Roaming Holiday", a travel podcast by
  Keith McNally.

  Given the episode title, description, and full transcript text, extract:
  1. **summary**: A concise summary of the episode, limit to 2–3 sentences,
     maximum 45 words.
     - Refer to the speaker as "Keith" or "he/him".
     - Do not repeat the title of the podcast or the episode — focus on
       describing the content and themes of the episode.
     - Mention specific place names but avoid listing them exhaustively.

  2. **places**: All place names mentioned (cities, countries, trails, landmarks,
     businesses, etc.).

  3. **keywords**: 3–5 relevant keywords or short phrases capturing the main
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

  Return only the JSON object with these three fields.
`.trim();
