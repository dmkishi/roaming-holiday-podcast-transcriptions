import type { Duration } from '@lib/shared/duration.js';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words: {
    text: string;
    start: number;
    end: number;
    confidence?: number;
  }[];
  timelineMarker?: boolean;
}

export interface SiteEpisode {
  episodeNumber: number;
  title: string;
  description: string;
  pubDate: string;
  duration: Duration;
  imageUrl: string;
  mp3Url: string;
  imagePath: string;
  paragraphGroups: TranscriptSegment[][][];
  location?: string;
  youtubeUrl?: string;
  isInterlude?: boolean;
}

// =============================================================================
// Stats
// =============================================================================
export interface EpisodeStat {
  episodeNumber: number;
  title: string;
  pubDate: string;
  durationSeconds: number;
  url: string;
}

export interface EpisodeWordStat extends EpisodeStat {
  wordCount: number;
}

export interface PodcastStats {
  totalEpisodes: number;
  totalDurationSeconds: number;
  averageEpisodeDurationSeconds: number;
  longestEpisode: EpisodeStat;
  shortestEpisode: EpisodeStat;
  totalTranscribedEpisodes: number;
  totalTranscribedWordCount: number;
  averageTranscribedEpisodeWordCount: number;
  wordiestEpisode: EpisodeWordStat;
  leastWordiestEpisode: EpisodeWordStat;
  mostFucks: EpisodeWordStat;
}
