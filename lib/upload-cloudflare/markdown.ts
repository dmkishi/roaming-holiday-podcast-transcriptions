import { stringify as stringifyYaml } from 'yaml';
import { formatDate } from '#lib/shared/strings.ts';

interface EpisodeMeta {
  episodeNumber: number;
  title: string;
  description: string;
  pubDate: string;
}

/**
 * Render an episode's transcript Markdown:
 *
 * - YAML frontmatter
 * - `# title` heading
 * - Paragraph groups separated by `---`.
 *
 * Pure and console-silent; used by the Cloudflare upload to build each item's
 * body in memory.
 */
export function renderEpisodeMarkdown(
  ep: EpisodeMeta,
  paragraphGroups: { text: string }[][][],
): string {
  const frontmatter = stringifyYaml({
    episode_number: ep.episodeNumber,
    title: ep.title,
    description: ep.description,
    pub_date: formatDate(new Date(ep.pubDate)),
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
