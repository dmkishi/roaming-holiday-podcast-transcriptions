import { stringify as stringifyYaml } from 'yaml';
import type { MetadataFile } from '@lib/shared/artifacts.js';
import type { ParagraphGroup } from '@lib/shared/schemas.js';
import { formatDate } from '@lib/shared/strings.js';

/**
 * Builds a Markdown transcript document with YAML frontmatter, separating
 * paragraph groups with `---`.
 */
export function buildMarkdown(
  metadata: MetadataFile,
  paragraphGroups: ParagraphGroup[],
): string {
  const frontmatter = stringifyYaml({
    episode_number: metadata.episodeNumber,
    title: metadata.title,
    description: metadata.description,
    pub_date: formatDate(new Date(metadata.pubDate)),
  });

  const blocks: string[] = [`# ${metadata.title}`];
  for (const [i, group] of paragraphGroups.entries()) {
    if (i > 0) blocks.push('---');
    for (const paragraph of group) {
      blocks.push(paragraph.map((s) => s.text).join('').trim());
    }
  }

  return `---\n${frontmatter}---\n\n${blocks.join('\n\n')}\n`;
}
