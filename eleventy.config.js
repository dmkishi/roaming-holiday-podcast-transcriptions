import postcss from 'postcss';
import postcssImport from 'postcss-import';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('www/src/js');

  eleventyConfig.addTemplateFormats('css');
  eleventyConfig.addExtension('css', {
    outputFileExtension: 'css',
    compile: async function (_content, inputPath) {
      if (path.basename(inputPath).startsWith('_')) return;

      return async () => {
        const css = await readFile(inputPath, 'utf8');
        const result = await postcss([postcssImport]).process(css, {
          from: inputPath,
        });
        return result.css;
      };
    },
  });

  eleventyConfig.addFilter('formatTimestamp', (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  });

  eleventyConfig.addFilter('formatDate', (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  return {
    dir: {
      input: 'www/src',
      output: 'www/dist',
    },
  };
}
