import { createHash } from 'node:crypto';

const DEFAULT_MAX_BYTES = 180_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 4;

const TRUSTED_EVIDENCE_HOSTS = [
  'api.github.com',
  'github.com',
  'bitcoin.org',
  'bitcoincore.org',
  'ethereum.org',
  'blog.ethereum.org',
  'geth.ethereum.org',
  'xrpl.org',
  'xrpl.foundation',
  'solana.com',
  'anza.xyz',
  'coindesk.com',
  'theblock.co',
  'decrypt.co',
  'cointelegraph.com',
  'reuters.com',
  'bloomberg.com',
  'ft.com',
  'wsj.com',
  'cnbc.com',
  'yna.co.kr',
  'hankyung.com',
  'mk.co.kr',
  'sedaily.com',
  'chosunbiz.com',
  'biz.chosun.com',
  'news.google.com',
] as const;

const normalizeHostname = (value: string) => value.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');

const hostMatches = (host: string, trusted: string) => {
  const normalizedHost = normalizeHostname(host);
  const normalizedTrusted = normalizeHostname(trusted);
  return normalizedHost === normalizedTrusted || normalizedHost.endsWith(`.${normalizedTrusted}`);
};

export const isTrustedEvidenceUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    return TRUSTED_EVIDENCE_HOSTS.some((host) => hostMatches(url.hostname, host));
  } catch {
    return false;
  }
};

const decodeEntities = (value: string) => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const cleanText = (value: string) => decodeEntities(value)
  .replace(/\s+/g, ' ')
  .trim();

const extractAttribute = (html: string, key: string, names: string[]) => {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return cleanText(match[1]).slice(0, key === 'title' ? 500 : 2_000);
    }
  }
  return '';
};

const extractTitle = (html: string) => {
  const meta = extractAttribute(html, 'title', ['og:title', 'twitter:title']);
  if (meta) return meta;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? cleanText(match[1]).slice(0, 500) : '';
};

const extractDescription = (html: string) => extractAttribute(html, 'description', [
  'description',
  'og:description',
  'twitter:description',
]);

const extractPublishedAt = (html: string) => {
  const value = extractAttribute(html, 'date', [
    'article:published_time',
    'datePublished',
    'date',
    'pubdate',
    'publish-date',
  ]);
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractReadableText = (html: string) => {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg|canvas|noscript|form|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const article = withoutNoise.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] || withoutNoise;
  return cleanText(article
    .replace(/<(br|p|div|li|section|h[1-6]|tr|td|blockquote)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
};

const readLimitedBody = async (response: Response, maxBytes: number) => {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new Error(`Evidence page exceeds ${maxBytes} bytes.`);
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Evidence page exceeds ${maxBytes} bytes.`);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
};

const fetchTrusted = async (initialUrl: string, timeoutMs: number) => {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!isTrustedEvidenceUrl(currentUrl)) throw new Error('Evidence URL host is not on the trusted-source allowlist.');
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'BlackOracle-EvidenceReader/0.3',
        Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.1',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Evidence redirect ${response.status} did not provide a location.`);
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isTrustedEvidenceUrl(nextUrl)) throw new Error('Evidence redirect target is not on the trusted-source allowlist.');
      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) throw new Error(`Evidence page returned HTTP ${response.status}.`);
    return { response, finalUrl: currentUrl };
  }
  throw new Error('Evidence page exceeded the redirect limit.');
};

export type WebEvidenceRead = {
  requestedUrl: string;
  finalUrl: string;
  title: string;
  summary: string;
  text: string;
  publishedAt: number | null;
  fetchedAt: number;
  contentHash: string;
  contentType: string;
};

export const readEvidenceWebPage = async (
  requestedUrl: string,
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<WebEvidenceRead> => {
  if (!isTrustedEvidenceUrl(requestedUrl)) throw new Error('Evidence URL is not trusted.');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const { response, finalUrl } = await fetchTrusted(requestedUrl, timeoutMs);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('application/json') && !contentType.includes('text/plain')) {
    throw new Error(`Unsupported evidence content type: ${contentType || 'unknown'}.`);
  }

  const raw = await readLimitedBody(response, maxBytes);
  const isHtml = contentType.includes('html') || /<html|<article|<title/i.test(raw);
  const text = isHtml ? extractReadableText(raw) : cleanText(raw);
  const title = isHtml ? extractTitle(raw) : '';
  const summary = (isHtml ? extractDescription(raw) : '') || text.slice(0, 1_200);
  const publishedAt = isHtml ? extractPublishedAt(raw) : null;
  const fetchedAt = Date.now();
  const contentHash = createHash('sha256').update(`${finalUrl}\n${text}`).digest('hex');

  return {
    requestedUrl,
    finalUrl,
    title,
    summary: cleanText(summary).slice(0, 1_200),
    text: text.slice(0, 12_000),
    publishedAt,
    fetchedAt,
    contentHash,
    contentType,
  };
};
