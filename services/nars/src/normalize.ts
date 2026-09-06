const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid',
];

export function normalizeTitle(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^\s*\[(속보|종합|단독|영상|알림)\]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = '';
  for (const key of TRACKING_PARAMS) url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export function looksBreaking(title: string): boolean {
  return /^\s*\[(속보|breaking|urgent|alert)\]/iu.test(title);
}

export function clampTier(value: number | undefined): number {
  if (!Number.isFinite(value)) return 2;
  return Math.max(0, Math.min(5, Math.round(value!)));
}
