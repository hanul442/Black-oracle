import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../src/rss.ts';
import type { SourceRecord } from '../src/types.ts';

const source: SourceRecord = {
  key: 'test-feed',
  name: 'Test Feed',
  type: 'rss',
  endpoint: 'https://example.com/feed.xml',
  language: 'ko',
  tier: 2,
};

test('parses RSS including CDATA, entities and breaking flag', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <guid>story-1</guid>
    <title><![CDATA[[속보] 한국은행 &amp; 시장 발표]]></title>
    <link>https://example.com/news/1?utm_source=rss</link>
    <pubDate>Sun, 06 Sep 2026 03:00:00 GMT</pubDate>
    <description><![CDATA[<p>핵심 <b>내용</b>입니다.</p>]]></description>
  </item></channel></rss>`;

  const docs = parseFeed(xml, source);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].externalId, 'story-1');
  assert.equal(docs[0].title, '[속보] 한국은행 & 시장 발표');
  assert.equal(docs[0].isBreaking, true);
  assert.equal(docs[0].excerpt, '핵심 내용 입니다.');
  assert.equal(docs[0].publishedAt, '2026-09-06T03:00:00.000Z');
});

test('parses Atom link href and falls back to id', () => {
  const xml = `<?xml version="1.0"?><feed><entry>
    <id>https://example.com/atom/2</id>
    <title>Fed outlook update</title>
    <link rel="alternate" href="https://example.com/atom/2" />
    <updated>2026-09-06T04:10:00Z</updated>
    <summary>Policy update</summary>
  </entry></feed>`;

  const docs = parseFeed(xml, { ...source, language: 'en' });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].url, 'https://example.com/atom/2');
  assert.equal(docs[0].externalId, 'https://example.com/atom/2');
  assert.equal(docs[0].isBreaking, false);
  assert.equal(docs[0].publishedAt, '2026-09-06T04:10:00.000Z');
});

test('drops feed entries without a usable HTTP URL', () => {
  const xml = `<rss><channel><item><title>No URL</title><guid>opaque-id</guid></item></channel></rss>`;
  assert.equal(parseFeed(xml, source).length, 0);
});
