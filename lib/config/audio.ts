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

// -----------------------------------------------------------------------------
// Fade detection (Essentia)
// -----------------------------------------------------------------------------
/**
 * Maximum gap (seconds) between a fade-out's end and the following fade-in's
 * start for the two to be treated as a single transition. Negative gaps
 * (crossfades where the in begins before the out ends) are always accepted.
 */
export const FADE_PAIR_MAX_GAP_SECONDS = 2;

/**
 * Essentia `FadeDetection` thresholds expressed as fractions of the average
 * RMS. Values above `cutoffHigh` mark the loud end of a fade; values below
 * `cutoffLow` mark the quiet end.
 */
export const FADE_CUTOFF_HIGH = .85;
export const FADE_CUTOFF_LOW = .2;

/**
 * Minimum fade duration (seconds) to keep. Shorter transitions are usually
 * speech dynamics, not musical fades.
 */
export const FADE_MIN_LENGTH_SECONDS = 1.5;

/**
 * RMS analysis window. 2048 samples at 16 kHz is ~128 ms; hop of 1024 gives
 * 50% overlap and an effective frame rate of ~15.6 fps.
 */
export const FADE_FRAME_SIZE = 2048;
export const FADE_HOP_SIZE = 1024;
