import { looksBreaking } from './normalize';
import type { IngestDocument, SourceRecord } from './types';

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function cleanText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = decodeXml(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tag(block: string, names: string[]): string | undefined {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
    const value = cleanText(match?.[1]);
    if (value) return value;
  }
  return undefined;
}

function link(block: string): string | undefined {
  const atomHref = block.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/i)?.[1];
  const candidate = cleanText(atomHref) ?? tag(block, ['link', 'guid', 'id']);
  return candidate && /^https?:\/\//i.test(candidate) ? candidate : undefined;
}

function toIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function blocks(xml: string, element: 'item' | 'entry'): string[] {
  const result: string[] = [];
  const regex = new RegExp(`<${element}\\b[^>]*>([\\s\\S]*?)<\\/${element}>`, 'gi');
  for (const match of xml.matchAll(regex)) result.push(match[1]);
  return result;
}

export function parseFeed(xml: string, source: SourceRecord): IngestDocument[] {
  const rssItems = blocks(xml, 'item');
  const feedItems = rssItems.length ? rssItems : blocks(xml, 'entry');

  return feedItems.flatMap((item) => {
    const title = tag(item, ['title']);
    const url = link(item);
    if (!title || !url) return [];

    const publishedAt = toIso(tag(item, ['pubDate', 'published', 'updated', 'dc:date', 'date']));
    const excerpt = tag(item, ['description', 'summary', 'content', 'content:encoded'])?.slice(0, 2000);
    const externalId = tag(item, ['guid', 'id']);

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
