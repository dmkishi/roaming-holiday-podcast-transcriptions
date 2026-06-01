export interface Duration {
  readonly seconds: number;
  readonly timestamp: string;
  readonly human: string;
}

/**
 * Parses a colon-separated duration string ("H:MM:SS", "MM:SS", or "SS") into
 * a Duration with seconds, normalized timestamp, and human-readable form.
 */
export function parseDuration(input: string): Duration {
  const [secs = 0, mins = 0, hrs = 0] = input.split(':').map(Number).toReversed();
  const totalSeconds = hrs * 3_600 + mins * 60 + secs;
  return fromSeconds(totalSeconds);
}

/**
 * Creates a Duration from a total number of seconds.
 */
export function fromSeconds(totalSeconds: number): Duration {
  const hrs = Math.floor(totalSeconds / 3_600);
  const mins = Math.floor((totalSeconds % 3_600) / 60);
  const secs = Math.round(totalSeconds % 60);

  const timestamp = `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  const human = parts.join(' ');

  return { seconds: totalSeconds, timestamp, human };
}
