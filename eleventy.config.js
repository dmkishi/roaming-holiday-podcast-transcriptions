import cssnano from 'cssnano';
import { transform as esbuildTransform } from 'esbuild';
import { minify } from 'html-minifier-terser';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssPresetEnv from 'postcss-preset-env';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

export default function(eleventyConfig) {
  /**
   * - runMode is `build` when `pnpm www:build`
   * - runMode is `serve` when `pnpm www:dev`
   */
  let isProd = true;
  eleventyConfig.on('eleventy.before', ({ runMode }) => {
    isProd = runMode === 'build';
  });

  // Bundle and minify CSS
  eleventyConfig.addTemplateFormats('css');
  eleventyConfig.addExtension('css', {
    outputFileExtension: 'css',
    compile: async function(_content, inputPath) {
      if (path.basename(inputPath).startsWith('_')) return;

      return async () => {
        const css = await readFile(inputPath, 'utf8');
        const plugins = [postcssImport, ...(isProd ? [postcssPresetEnv] : []), cssnano];
        const result = await postcss(plugins).process(css, {
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
    compile: async function(_content, inputPath) {
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
   * Format seconds to a timecode string, rounded to the nearest minute.
   * @example
   * {{ 65 | formatRoundedTimecode }}   // => "0:01:00"
   * {{ 3661 | formatRoundedTimecode }} // => "1:01:00"
   */
  eleventyConfig.addFilter('formatRoundedTimecode', (seconds) => {
    const totalMins = Math.round(seconds / 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}:${String(mins).padStart(2, '0')}:00`;
  });

  /**
   * Format seconds to human-readable duration rounded to nearest minute.
   * @example
   * {{ 65 | formatRoundedHuman }}   // => "1m"
   * {{ 3661 | formatRoundedHuman }} // => "1h 1m"
   */
  eleventyConfig.addFilter('formatRoundedHuman', (seconds) => {
    const totalMins = Math.round(seconds / 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hrs > 0
      ? `${hrs} ${pluralize('hour', hrs)} ${mins} ${pluralize('minute', mins)}`
      : `${mins} ${pluralize('minute', mins)}`;
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
