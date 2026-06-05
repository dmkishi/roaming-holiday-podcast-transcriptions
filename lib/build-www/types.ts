import type { Duration } from '#lib/shared/duration.js';

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

export type JsonLd = Record<string, unknown>;

export interface SiteEpisode {
  episodeNumber: number;
  url: string;
  imagePath: string;
  supplement: {
    isInterlude?: boolean;
    location?: string;
    youtubeUrl?: string;
  };
  rss: {
    title: string;
    description: string;
    mp3Url: string;
    duration: Duration;
    pubDate: string;
    imageUrl: string;
  };
  jsonLd: JsonLd[];
  paragraphGroups: TranscriptSegment[][][];
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

export interface EpisodeRateStat extends EpisodeWordStat {
  fucksPerHour: number;
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
  totalFucks: number;
  averageFucks: number;
  mostFucksPerHour: EpisodeRateStat;
  mostFucks: EpisodeWordStat;
}
