import { stringify as stringifyYaml } from 'yaml';

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
  const frontmatter = stringifyYaml({
    episode_number: episode.episodeNumber,
    title: episode.title,
    description: episode.description,
    pub_date: new Date(episode.pubDate).toISOString().slice(0, 10),
  });

  const blocks = [`# ${episode.title}`];
  for (const [i, group] of episode.paragraphGroups.entries()) {
    if (i > 0) blocks.push('---');
    for (const paragraph of group) {
      blocks.push(paragraph.map((s) => s.text).join('').trim());
    }
  }

  return `---\n${frontmatter}---\n\n${blocks.join('\n\n')}\n`;
}
