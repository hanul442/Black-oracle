import { XMLParser } from 'fast-xml-parser';
import { looksBreaking } from './normalize';
import type { IngestDocument, SourceRecord } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    for (const key of ['#text', 'value', '@_href']) {
      if (typeof v[key] === 'string' && (v[key] as string).trim()) return (v[key] as string).trim();
    }
  }
  return undefined;
}

function toIso(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export function parseFeed(xml: string, source: SourceRecord): IngestDocument[] {
  const parsed = parser.parse(xml) as Record<string, any>;
  const rssItems = asArray(parsed?.rss?.channel?.item);
  const atomItems = asArray(parsed?.feed?.entry);
  const items = rssItems.length ? rssItems : atomItems;

  return items.flatMap((item: any) => {
    const title = text(item?.title);
    const url = text(item?.link) ?? text(item?.guid) ?? text(item?.id);
    if (!title || !url || !/^https?:\/\//i.test(url)) return [];

    const publishedAt = toIso(item?.pubDate ?? item?.published ?? item?.updated ?? item?.date);
    const excerpt = text(item?.description ?? item?.summary ?? item?.content)?.slice(0, 2000);
    const externalId = text(item?.guid ?? item?.id);

    return [{
      externalId,
      publishedAt,
      title,
      url,
      language: source.language,
      isBreaking: looksBreaking(title),
      excerpt,
      metadata: { feed: source.key },
    } satisfies IngestDocument];
  });
}
