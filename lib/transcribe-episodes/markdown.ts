import { stringify as stringifyYaml } from 'yaml';
import type { Paragraph } from '@lib/transcribe-episodes/paragraph.js';
import type { MetadataFile } from '@lib/shared/artifacts.js';
import { formatDate } from '@lib/shared/strings.js';

/**
 * Builds a Markdown transcript document with YAML frontmatter, splitting
 * paragraphs into paragraph groups separated by `---`.
 */
export function buildMarkdown(
  metadata: MetadataFile,
  paragraphs: Paragraph[],
  fadePairStarts: number[],
): string {
  const frontmatter = stringifyYaml({
    episode_number: metadata.episodeNumber,
    title: metadata.title,
    description: metadata.description,
    pub_date: formatDate(new Date(metadata.pubDate)),
  });

  const fadeStartSet = new Set(fadePairStarts);
  const blocks: string[] = [`# ${metadata.title}`];
  for (let i = 0; i < paragraphs.length; i++) {
    if (fadeStartSet.has(i) && i > 0) blocks.push('---');
    const text = paragraphs[i]!.map((s) => s.text).join('').trim();
    blocks.push(text);
  }

  return `---\n${frontmatter}---\n\n${blocks.join('\n\n')}\n`;
}
