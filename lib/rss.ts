import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TMP_DIR } from '@lib/config/paths.js';

export interface RssItem {
  title: string;
  description?: string;
  pubDate: string;
  guid: string;
  enclosure: { '@_url': string; '@_length': string };
  'itunes:duration': string;
  'itunes:image': { '@_href': string };
  'itunes:summary': string;
}

type RssFeedResponse =
  | { status: 'failed' }
  | {
      status: 'downloaded' | 'cached';
      items: RssItem[];
    };

interface CacheMeta {
  etag?: string;
  lastModified?: string;
}

/**
 * Fetch all items from an RSS feed, serving from cache when unchanged.
 * @todo Error message on fail would be helpful.
 * @todo Force options to bypass cache and re-download feed.
 */
export async function getAllRssItems(url: string): Promise<RssFeedResponse> {
  try {
    const paths = cachePathsFor(url);
    const cached = readCacheMeta(paths.meta);

    const headers: Record<string, string> = {};
    if (cached?.etag) headers['If-None-Match'] = cached.etag;
    if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;

    const res = await fetch(url, { headers });

    let xml: string;
    let status: 'downloaded' | 'cached';
    if (res.status === 304 && existsSync(paths.xml)) {
      xml = readFileSync(paths.xml, 'utf-8');
      status = 'cached';
    } else if (res.ok) {
      xml = await res.text();
      status = 'downloaded';
      const meta: CacheMeta = {
        etag: res.headers.get('etag')?.replace(/-gzip"$/, '"') ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
      };
      writeFileSync(paths.xml, xml);
      writeFileSync(paths.meta, JSON.stringify(meta));
    } else {
      return { status: 'failed' };
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item as RssItem[] | undefined;

    if (!items) return { status: 'failed' };
    return {
      status,
      items,
    };
  } catch {
    return { status: 'failed' };
  }
}

/**
 * Derive deterministic cache file paths in /tmp from a feed URL, e.g.:
 *
 * ```js
 * {
 *   xml: "/tmp/rss-a1b2c3d4e5f6.xml",
 *   meta: "/tmp/rss-a1b2c3d4e5f6.meta.json",
 * }
 * ```
 */
function cachePathsFor(url: string) {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 12);
  return {
    xml: resolve(TMP_DIR, `rss-${hash}.xml`),
    meta: resolve(TMP_DIR, `rss-${hash}.meta.json`),
  };
}

function readCacheMeta(path: string): CacheMeta | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as CacheMeta;
  } catch {
    return undefined;
  }
}
