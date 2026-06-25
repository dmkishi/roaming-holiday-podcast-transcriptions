import cssnano from 'cssnano';
import eleventyImage from '@11ty/eleventy-img';
import { transform as esbuildTransform } from 'esbuild';
import { minify } from 'html-minifier-terser';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssPresetEnv from 'postcss-preset-env';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildEpisodes } from './lib/eleventy/buildEpisodes.ts';
import { discoverArtifactsOnce, resetDiscoveryCache } from './lib/eleventy/discover.ts';
import { downloadImage } from './lib/eleventy/images.ts';
import { seriesLd } from './lib/eleventy/jsonLd.ts';
import { jsonLdScriptContent } from './lib/eleventy/jsonLdScriptContent.ts';
import { collectStats } from './lib/eleventy/stats.ts';
import { formatLongDate } from './lib/shared/strings.ts';
import { BASE_URL, SITE } from './lib/config/site.ts';

const CSS_DIR = 'www/src/css';

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

/**
 * Bundle and minify CSS, precompile entrypoints so `hashUrl` reflects the
 * resolved output, and register the `hashUrl` filter for cache busting.
 *
 * - isProd = true on `pnpm www:build` (runMode `build`),
 * - isProd = false on `pnpm www:dev` (runMode `serve`).
 */
function setupCss(eleventyConfig) {
  let isProd = true;
  const cssOutputCache = new Map(); // url (e.g. "/index.css") -> compiled css

  // Bundle CSS imports and minify. In production, also apply postcss-preset-env.
  async function compileCss(inputPath) {
    const css = await readFile(inputPath, 'utf8');
    const plugins = [postcssImport, ...(isProd ? [postcssPresetEnv] : []), cssnano];
    const result = await postcss(plugins).process(css, { from: inputPath });
    return result.css;
  }

  eleventyConfig.on('eleventy.before', async ({ runMode }) => {
    isProd = runMode === 'build';
    cssOutputCache.clear();
    if (!isProd) return;

    // Precompile CSS so hashUrl can hash the resolved output; source-file
    // hashing misses changes inside imported partials.
    const cssFiles =
      (await readdir(CSS_DIR)).filter((f) => f.endsWith('.css') && !f.startsWith('_'));
    await Promise.all(cssFiles.map(async (file) => {
      const compiled = await compileCss(path.join(CSS_DIR, file));
      cssOutputCache.set(`/css/${file}`, compiled);
    }));
  });

  eleventyConfig.addTemplateFormats('css');
  eleventyConfig.addExtension('css', {
    outputFileExtension: 'css',
    compile(_content, inputPath) {
      if (path.basename(inputPath).startsWith('_')) return;

      return async () => {
        const url = `/${path.relative('www/src', inputPath)}`;
        return cssOutputCache.get(url) ?? await compileCss(inputPath);
      };
    },
  });

  // Append a content-hash query string for cache busting (prod only)
  eleventyConfig.addFilter('hashUrl', (/** @type {string} */ url) => {
    if (!isProd) return url;
    const srcFile = url.endsWith('.js') ? url.replace(/\.js$/u, '.ts') : url;
    const source = cssOutputCache.get(url) ?? readFileSync(path.join('www/src', srcFile), 'utf8');
    const hash = createHash('md5').update(source).digest('hex').slice(0, 8);
    return `${url}?v=${hash}`;
  });
}

export default function configureEleventy(eleventyConfig) {
  // In `--watch` or `--serve` mode, ignore changes to a template's imported
  // JS/TS dependencies. Restart the dev server to pick those up.
  eleventyConfig.setWatchJavaScriptDependencies(false);

  // Watch episode source files so changes to `episodes/*.transcript.json` or
  // `episode-supplements.yaml` refreshes the dev server live.
  //
  // Disable gitignore filtering in Eleventy's watcher so that gitignore episode
  // source files are watched. This affects Eleventy's whole ignore set, so re-
  // ignore the output and episode image directories.
  eleventyConfig.setUseGitIgnore(false);
  for (const dir of ['www/dist/**', 'www/src/img/episodes/**']) {
    eleventyConfig.ignores.add(dir);
    eleventyConfig.watchIgnores.add(dir);
  }
  eleventyConfig.addWatchTarget('episodes/*.transcript.json');
  eleventyConfig.addWatchTarget('episode-supplements.yaml');

  // Plain values are captured once; the functions are re-evaluated per build,
  // so `--serve` picks up edits to episode sources (see the `eleventy.before`
  // memo reset below).
  eleventyConfig.addGlobalData('baseUrl', BASE_URL);
  eleventyConfig.addGlobalData('site', SITE);
  eleventyConfig.addGlobalData('episodes', () => buildEpisodes());
  eleventyConfig.addGlobalData('seriesJsonLd', () => seriesLd(SITE));
  eleventyConfig.addGlobalData('stats', () => collectStats(discoverArtifactsOnce()));

  // Before each build: reset the per-build discovery memo so a long-lived
  // `--serve` process re-reads sources after an edit (a plain module cache would
  // go stale), then ensure every episode's cover image exists on disk — the
  // `imageUrl` shortcode reads these source `.jpg` files during render. `downloadImage`
  // skips files that already exist, so warm rebuilds are just `existsSync` checks.
  eleventyConfig.on('eleventy.before', async () => {
    resetDiscoveryCache();
    for (const { rss } of discoverArtifactsOnce()) {
      const image = await downloadImage(rss.episodeNumber, rss.imageUrl);
      if (image.status === 'failed') {
        console.warn(`#${rss.episodeNumber}: Cover image download failed - ${image.error}`);
      }
    }
  });

  setupCss(eleventyConfig);

  // eleventyConfig.addPassthroughCopy({ 'www/src/img/*.svg': 'img' });

  // Strip TypeScript and minify
  eleventyConfig.addTemplateFormats('ts');
  eleventyConfig.addExtension('ts', {
    outputFileExtension: 'js',
    compile(_content, inputPath) {
      if (path.basename(inputPath).startsWith('_')) return;
      if (inputPath.endsWith('.d.ts')) return;

      return async () => {
        const ts = await readFile(inputPath, 'utf8');
        const result = await esbuildTransform(ts, { minify: true, loader: 'ts' });
        return result.code;
      };
    },
  });

  // Minify HTML
  eleventyConfig.addTransform('htmlmin', async (content, outputPath) => {
    if (outputPath?.endsWith('.html')) {
      return await minify(content, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
      });
    }
    return content;
  });

  /**
   * Resize an image to the given width and return the output URL.
   * @example
   * {% imageUrl 'img/cover.jpg', 600 %} // => "/img/cover-600w.webp"
   */
  eleventyConfig.addShortcode('imageUrl', async (src, width) => {
    const input = path.join('www/src', src);
    const subdir = path.relative('img', path.dirname(src));
    const metadata = await eleventyImage(input, {
      widths: [width],
      formats: ['webp'],
      outputDir: path.join('www/dist/img', subdir),
      urlPath: path.posix.join('/img', subdir, '/'),
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
   * {{ 217_988 | formatNumber }} // => "217,988"
   */
  eleventyConfig.addFilter('formatNumber', (n) =>
    Number(n).toLocaleString('en-US')
  );

  /**
   * Format a number with exactly one decimal place.
   * @example
   * {{ 12 | formatDecimal }}   // => "12.0"
   * {{ 12.34 | formatDecimal }} // => "12.3"
   */
  eleventyConfig.addFilter('formatDecimal', (n) =>
    Number(n).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
  );

  /**
   * Pluralize a word by appending "s" unless the count is exactly 1.
   * @example
   * {{ 'Bible' | pluralize(2) }} // "Bibles"
   */
  eleventyConfig.addFilter('pluralize', pluralize);

  /**
   * @example
   * {{ 2.2  | bibleEmojis | safe }} // 📖📖
   * {{ 2.25 | bibleEmojis | safe }} // 📖📖 + half 📖
   * {{ 2.5  | bibleEmojis | safe }} // 📖📖 + half 📖
   * {{ 2.74 | bibleEmojis | safe }} // 📖📖 + half 📖
   * {{ 2.75 | bibleEmojis | safe }} // 📖📖📖
   */
  eleventyConfig.addFilter('bibleEmojis', (count) => {
    // Snap to the nearest half: e.g. 2.2 → 2, 2.25 → 2.5, 2.75 → 3.
    const rounded = Math.round(count * 2) / 2;
    const whole = Math.floor(rounded);
    const hasHalf = rounded > whole;
    const emojis =
      '📖'.repeat(whole) + (hasHalf ? '<span class="bible-half">📖</span>' : '');
    return `<span role="img">${emojis}</span>`;
  });

  /**
   * Format seconds to a timecode string, rounded to the nearest minute.
   * @example
   * {{ 65 | formatRoundedTimecode }}   // => "1:00"
   * {{ 3_661 | formatRoundedTimecode }} // => "1:01:00"
   */
  eleventyConfig.addFilter('formatRoundedTimecode', (seconds) => {
    const totalMins = Math.round(seconds / 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs === 0) return `${mins}:00`;
    return `${hrs}:${String(mins).padStart(2, '0')}:00`;
  });

  /**
   * Format seconds to human-readable duration rounded to nearest minute.
   * @example
   * {{ 65 | formatRoundedHuman }}    // => "1m"
   * {{ 3_661 | formatRoundedHuman }}  // => "1h 1m"
   * {{ 3_660 | formatRoundedHuman }}  // => "1h"
   * {{ 90_000 | formatRoundedHuman }} // => "1d 1h"
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
   * {{ '2026-04-04' | formatLongDate }} // => "April 4, 2026"
   */
  eleventyConfig.addFilter('formatLongDate', (dateStr) => formatLongDate(dateStr));

  /**
   * Extract the video ID from a YouTube URL.
   * @example
   * {{ 'https://www.youtube.com/watch?v=abc123' | youtubeId }} // => "abc123"
   */
  eleventyConfig.addFilter('youtubeId', (url) =>
    new URL(url).searchParams.get('v') ?? ''
  );

  /**
   * Serialize a JSON-LD object into escaped JSON for embedding inside a
   * `<script type="application/ld+json">` element. Pipe through `safe` so
   * Nunjucks emits the JSON verbatim rather than HTML-escaping it.
   * @example
   * <script type="application/ld+json">
   *   {{- ldObject | jsonLdScriptContent | safe -}}
   * </script>
   */
  eleventyConfig.addFilter('jsonLdScriptContent', jsonLdScriptContent);

  return {
    dir: {
      input: 'www/src',
      output: 'www/dist',
    },
  };
}
