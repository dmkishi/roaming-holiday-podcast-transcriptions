export const BASE_URL = 'https://dmkishi.github.io/roaming-holiday-podcast-transcriptions';

export interface Site {
  title: string;
  descriptionHtml: string;
  podcast: {
    name: string;
    author: string;
    homepage: string;
    rssUrl: string;
    image: string;
    platforms: Record<string, string>;
  };
}

export const SITE: Site = {
  title: 'Roaming Holiday Transcripts',
  descriptionHtml:
    'This is an <i>unofficial</i> transcript site for the <a href="https://keithcourage.com/rh/">Roaming Holiday podcast</a> by Keith McNally. All episode titles, descriptions, photos, and videos are the property of the author.',
  podcast: {
    name: 'Roaming Holiday',
    author: 'Keith McNally',
    homepage: 'https://keithcourage.com/rh/',
    rssUrl: 'https://keithcourage.com/rh/rss/rss.xml',
    image: 'https://keithcourage.com/rh/images/rhlogo.jpg',
    platforms: {
      apple: 'https://podcasts.apple.com/us/podcast/roaming-holiday/id1708646675',
      spotify: 'https://open.spotify.com/show/3SxMKIOKJwbgUs3fbwSncD',
      youtube: 'https://www.youtube.com/playlist?list=PLHsvN4hgousAB1aBl-dDwIs_JaBMGMvQd',
    },
  },
};
