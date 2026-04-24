export const DEFAULT_MODEL = 'base';

/**
 * The Whisper prompt is not instructional but provides context about the style
 * of speech patterns in the audio. Here, we provide proper nouns to condition
 * Whisper to recognize and spell them correctly.
 */
export const PROMPT = {
  // List names (places, brands, etc.) often mentioned in the podcast that may
  // be or are misheard or misspelled by the model.
  names: [
    '7-Eleven',
    'Ediya Coffee',
    'Family Mart',
    'Hi-Chew',
    'Jeju Island',
    'Louisa Coffee',
    'Moontan Trail',
    'Olle Trail',
    'Tim Hortons',
  ],
  basicInfo: '"Roaming Holiday" by Keith McNally of Fredericton, New Brunswick.',
} as const;
