import { renderEpisodeMarkdown } from '#lib/shared/episodeMarkdown.ts';

/*
 * Emit a Markdown transcript (`/episodes/N.md`) alongside each episode's HTML
 * page, paginating over the same `episodes` data as `episodes.njk`.
 */
export const data = {
  pagination: { data: 'episodes', size: 1, alias: 'episode' },
  permalink: (item) => `/episodes/${item.episode.episodeNumber}.md`,
  eleventyExcludeFromCollections: true,
};

export function render({ episode }) {
  return renderEpisodeMarkdown(
    { episodeNumber: episode.episodeNumber, ...episode.rss },
    episode.paragraphGroups,
  );
}
