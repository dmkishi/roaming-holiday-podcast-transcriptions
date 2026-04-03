export function formatEpisodeNumber(episodeNumber: number): string {
  return String(episodeNumber).padStart(3, '0');
}
