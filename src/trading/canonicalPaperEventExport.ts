import type { CanonicalPaperEventRow } from './canonicalPaperProtectionReplay';

export interface CanonicalPaperEventExportOptions {
  runtimeId: string;
  supabaseUrl: string;
  supabaseKey: string;
  pageSize?: number;
  maxRows?: number;
  fetchImpl?: typeof fetch;
}

export interface CanonicalPaperEventExportResult {
  runtimeId: string;
  rows: CanonicalPaperEventRow[];
  pages: number;
  pageSize: number;
  truncated: boolean;
}

const boundedInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

/**
 * Read-only, runtime-scoped exporter for canonical Paper events.
 *
 * This intentionally does not share mutation helpers or instantiate any trading
 * runtime. It only issues GET requests against `black_oracle_events`, pages in
 * deterministic canonical order, and returns the raw snake_case rows expected
 * by the shadow replay adapter.
 */
export const exportCanonicalPaperEvents = async (
  options: CanonicalPaperEventExportOptions,
): Promise<CanonicalPaperEventExportResult> => {
  const runtimeId = options.runtimeId.trim();
  const base = options.supabaseUrl.trim().replace(/\/+$/, '');
  const key = options.supabaseKey.trim();
  if (!runtimeId) throw new Error('runtimeId is required.');
  if (!base) throw new Error('supabaseUrl is required.');
  if (!key) throw new Error('supabaseKey is required.');

  const pageSize = boundedInteger(options.pageSize, 500, 1, 1_000);
  const maxRows = boundedInteger(options.maxRows, 50_000, 1, 100_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const rows: CanonicalPaperEventRow[] = [];
  let pages = 0;
  let offset = 0;
  let exhausted = false;

  while (rows.length < maxRows && !exhausted) {
    const remaining = maxRows - rows.length;
    const limit = Math.min(pageSize, remaining);
    const url = new URL(`${base}/rest/v1/black_oracle_events`);
    url.searchParams.set('select', 'runtime_id,occurred_at,event_name,strategy_version,trace');
    url.searchParams.set('runtime_id', `eq.${runtimeId}`);
    url.searchParams.set('order', 'occurred_at.asc,recorded_at.asc,id.asc');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Canonical Paper event export failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
    }

    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Canonical Paper event export returned a non-array response.');

    for (const row of page) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      rows.push(row as CanonicalPaperEventRow);
    }

    pages += 1;
    offset += page.length;
    exhausted = page.length < limit;
    if (page.length === 0) exhausted = true;
  }

  return {
    runtimeId,
    rows,
    pages,
    pageSize,
    truncated: !exhausted && rows.length >= maxRows,
  };
};
