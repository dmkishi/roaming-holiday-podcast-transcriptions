import type { Duration } from '@lib/shared/duration.js';

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  timelineMarker?: boolean;
}

export interface ResolvedSection {
  title: string;
  segmentIndex: number;
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
  segments: TranscriptSegment[];
  sections: ResolvedSection[];
  summary: string;
  places: string[];
  keywords: string[];
  location?: string;
  youtube?: string;
}
