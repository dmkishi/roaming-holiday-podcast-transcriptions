import { stringify as stringifyYaml } from 'yaml';

interface EpisodeMeta {
  episodeNumber: number;
  title: string;
  description: string;
  pubDate: string;
}

/**
 * Render an episode's transcript Markdown: YAML frontmatter, a `# title`
 * heading, then paragraph groups separated by `---`. Pure and console-silent so
 * both the Eleventy `.md` template and the Cloudflare upload share one renderer
 * and stay byte-identical.
 */
export function renderEpisodeMarkdown(
  ep: EpisodeMeta,
  paragraphGroups: { text: string }[][][],
): string {
  const frontmatter = stringifyYaml({
    episode_number: ep.episodeNumber,
    title: ep.title,
    description: ep.description,
    pub_date: new Date(ep.pubDate).toISOString().slice(0, 10),
  });

  const blocks = [`# ${ep.title}`];
  for (const [i, group] of paragraphGroups.entries()) {
    if (i > 0) blocks.push('---');
    for (const paragraph of group) {
      blocks.push(paragraph.map((s) => s.text).join('').trim());
    }
  }

  return `---\n${frontmatter}---\n\n${blocks.join('\n\n')}\n`;
}
