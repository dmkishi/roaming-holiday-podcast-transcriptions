/**
 * The Whisper prompt is not instructional but provides context about the style
 * speech patterns of the audio. Here, we include proper nouns and names to help
 * Whisper recognize and spell them correctly.
 */
export const BASE_PROMPT = `
  "Roaming Holiday" is a travel podcast by Keith McNally of Fredericton, New
  Brunswick. He travels through Asia, mainly Japan, South Korea, and Taiwan.
`.trim();

export const SYSTEM_PROMPT = `
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
