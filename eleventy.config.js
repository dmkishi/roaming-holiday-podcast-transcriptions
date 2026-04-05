import cssnano from 'cssnano';
import { transform as esbuildTransform } from 'esbuild';
import { minify } from 'html-minifier-terser';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export default function (eleventyConfig) {
  // Bundle and minify CSS
  eleventyConfig.addTemplateFormats('css');
  eleventyConfig.addExtension('css', {
    outputFileExtension: 'css',
    compile: async function (_content, inputPath) {
      if (path.basename(inputPath).startsWith('_')) return;

      return async () => {
        const css = await readFile(inputPath, 'utf8');
        const result = await postcss([postcssImport, cssnano]).process(css, {
          from: inputPath,
        });
        return result.css;
      };
    },
  });

  // Minify JS
  eleventyConfig.addTemplateFormats('js');
  eleventyConfig.addExtension('js', {
    outputFileExtension: 'js',
    compile: async function (_content, inputPath) {
      if (path.basename(inputPath).startsWith('_')) return;

      return async () => {
        const js = await readFile(inputPath, 'utf8');
        const result = await esbuildTransform(js, { minify: true });
        return result.code;
      };
    },
  });

  // Minify HTML
  eleventyConfig.addTransform('htmlmin', async (content, outputPath) => {
    if (outputPath?.endsWith('.html')) {
      return minify(content, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
      });
    }
    return content;
  });

  /**
   * Format seconds to a timestamp string.
   * @example
   * {{ 61 | formatTimestamp }}   // => "1:01"
   * {{ 3661 | formatTimestamp }} // => "1:01:01"
   */
  eleventyConfig.addFilter('formatTimestamp', (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  });

  /**
   * Format an ISO date string as a long-form US English date.
   * @example
   * {{ '2026-04-04' | formatDate }} // => "April 4, 2026"
   */
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
