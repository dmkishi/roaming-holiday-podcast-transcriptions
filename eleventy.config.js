import cssnano from 'cssnano';
import Image from '@11ty/eleventy-img';
import { transform as esbuildTransform } from 'esbuild';
import { minify } from 'html-minifier-terser';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssPresetEnv from 'postcss-preset-env';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

  // Append a content-hash query string for cache busting (prod only)
  eleventyConfig.addFilter('hashUrl', (url) => {
    if (!isProd) return url;
    const filePath = path.join('www/src', url);
    const content = readFileSync(filePath, 'utf8');
    const hash = createHash('md5').update(content).digest('hex').slice(0, 8);
    return `${url}?v=${hash}`;
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

  eleventyConfig.addShortcode('imageUrl', async (src, width) => {
    const input = path.join('www/src', src);
    const metadata = await Image(input, {
      widths: [width],
      formats: ['webp'],
      outputDir: 'www/dist/img',
      urlPath: '/img/',
      filenameFormat: (_hash, _src, w, format) => {
        const name = path.basename(_src, path.extname(_src));
        return `${name}-${w}w.${format}`;
      },
    });
    return metadata.webp[0].url;
  });

  /**
   * Format a number with locale-appropriate separators.
   * @example
   * {{ 217988 | formatNumber }} // => "217,988"
   */
  eleventyConfig.addFilter('formatNumber', (n) => {
    return Number(n).toLocaleString('en-US');
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
   * {{ 65 | formatRoundedHuman }}    // => "1m"
   * {{ 3661 | formatRoundedHuman }}  // => "1h 1m"
   * {{ 3660 | formatRoundedHuman }}  // => "1h"
   * {{ 90000 | formatRoundedHuman }} // => "1d 1h"
   */
  eleventyConfig.addFilter('formatRoundedHuman', (seconds) => {
    const totalMins = Math.round(seconds / 60);
    const totalHrs = Math.floor(totalMins / 60);
    const days = Math.floor(totalHrs / 24);
    const hrs = totalHrs % 24;
    const mins = totalMins % 60;
    const parts = [];
    if (days > 0) parts.push(`${days} ${pluralize('day', days)}`);
    if (hrs > 0) parts.push(`${hrs} ${pluralize('hour', hrs)}`);
    if (mins > 0) parts.push(`${mins} ${pluralize('minute', mins)}`);
    return parts.join(' ') || `0 ${pluralize('minute', 0)}`;
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

  /**
   * Extract the video ID from a YouTube URL.
   * @example
   * {{ 'https://www.youtube.com/watch?v=abc123' | youtubeId }} // => "abc123"
   */
  eleventyConfig.addFilter('youtubeId', (url) => {
    return new URL(url).searchParams.get('v') || '';
  });

  return {
    dir: {
      input: 'www/src',
      output: 'www/dist',
    },
  };
}
