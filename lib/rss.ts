import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { handleize } from '@lib/utils/strings.js';
import { TMP_DIR } from '@lib/config/paths.js';

const RssItemSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  pubDate: z.string(),
  guid: z.string(),
  enclosure: z.object({ '@_url': z.string(), '@_length': z.string() }),
  'itunes:duration': z.string(),
  'itunes:image': z.object({ '@_href': z.string() }),
  'itunes:summary': z.string(),
});

const RssFeedSchema = z.object({
  rss: z.object({
    channel: z.object({
      item: z.array(RssItemSchema),
    }),
  }),
});

export type RssItem = z.infer<typeof RssItemSchema>;

type RssFeedResponse =
  | { status: 'failed' }
  | {
      status: 'downloaded' | 'cached';
      items: RssItem[];
    };

/**
 * Fetch all items from an RSS feed, serving from cache when unchanged.
 * @todo Error message on fail would be helpful.
 * @todo Force options to bypass cache and re-download feed.
 */
export async function getAllRssItems(url: string): Promise<RssFeedResponse> {
  try {
    const cachePaths = cachePathsFor(url);
    const cacheEtag = readCachedEtag(cachePaths.etag);
    const requestHeaders = cacheEtag === undefined
      ? undefined
      : { 'If-None-Match': cacheEtag };

    const res = await fetch(url, { headers: requestHeaders });
    let xml: string;
    let status: 'downloaded' | 'cached';
    if (res.status === 304 && existsSync(cachePaths.xml)) {
      xml = readFileSync(cachePaths.xml, 'utf8');
      status = 'cached';
    } else if (res.ok) {
      xml = await res.text();
      status = 'downloaded';
      writeFileSync(cachePaths.xml, xml);
      const newEtag = res.headers.get('etag')?.replace(/-gzip"$/, '"') ?? '';
      if (newEtag !== '') writeFileSync(cachePaths.etag, newEtag);
    } else {
      return { status: 'failed' };
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = RssFeedSchema.safeParse(parser.parse(xml));
    if (!parsed.success) return { status: 'failed' };
    const items = parsed.data.rss.channel.item;
    return { status, items };
  } catch {
    return { status: 'failed' };
  }
}

/**
 * Derive deterministic cache file paths in /tmp from a feed URL, e.g.:
 *
 * ```js
 * {
 *   xml: "/tmp/https-keithcourage-com-rh-rss-rss-xml.xml",
 *   etag: "/tmp/https-keithcourage-com-rh-rss-rss-xml.etag.txt",
 * }
 * ```
 */
function cachePathsFor(url: string) {
  const handleizedUrl = handleize(url);
  return {
    xml: resolve(TMP_DIR, `${handleizedUrl}.xml`),
    etag: resolve(TMP_DIR, `${handleizedUrl}.etag.txt`),
  };
}

function readCachedEtag(path: string): string | undefined {
  try {
    const etag = readFileSync(path, 'utf8');
    return etag || undefined;
  } catch {
    return undefined;
  }
}
