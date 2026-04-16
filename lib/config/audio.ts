// -----------------------------------------------------------------------------
// Paragraph
// -----------------------------------------------------------------------------
export const PARAGRAPH_GAP_SECONDS = 1.45;
export const PARAGRAPH_GROUP_GAP_SECONDS = 5;

// -----------------------------------------------------------------------------
// Chunk
// -----------------------------------------------------------------------------
/**
 * Ideal length of each audio chunk. Cut points are placed near multiples of
 * this.
 */
export const CHUNK_TARGET_MINUTES = 15;

/**
 * Half-width of the initial search window around each target cut point, and the
 * step size by which it widens when no gap is found.
 */
export const CHUNK_INITIAL_WINDOW_MINUTES = 2;

/**
 * Maximum half-width of the search window before falling back to a hard cut at
 * the target time.
 */
export const CHUNK_MAX_WINDOW_MINUTES = 6;

// -----------------------------------------------------------------------------
// VAD
// -----------------------------------------------------------------------------
/**
 * Minimum non-speech duration (seconds) to count as a gap.
 */
export const MIN_GAP_SECONDS = .4;
