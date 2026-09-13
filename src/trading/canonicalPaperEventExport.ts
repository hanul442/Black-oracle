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
  snapshotRecordedAt: string | null;
}

const boundedInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const readSnapshotRecordedAt = async (
  base: string,
  runtimeId: string,
  key: string,
  fetchImpl: typeof fetch,
): Promise<string | null> => {
  const url = new URL(`${base}/rest/v1/black_oracle_events`);
  url.searchParams.set('select', 'recorded_at');
  url.searchParams.set('runtime_id', `eq.${runtimeId}`);
  url.searchParams.set('order', 'recorded_at.desc');
  url.searchParams.set('limit', '1');

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
    throw new Error(`Canonical Paper event snapshot read failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }

  const body = await response.json();
  if (!Array.isArray(body)) throw new Error('Canonical Paper event snapshot read returned a non-array response.');
  if (body.length === 0) return null;

  const recordedAt = body[0]?.recorded_at;
  if (typeof recordedAt !== 'string' || !recordedAt.trim()) {
    throw new Error('Canonical Paper event snapshot read returned an invalid recorded_at watermark.');
  }
  return recordedAt;
};

/**
 * Read-only, runtime-scoped exporter for canonical Paper events.
 *
 * This intentionally does not share mutation helpers or instantiate any trading
 * runtime. It only issues GET requests against `black_oracle_events`.
 *
 * A `recorded_at` high-watermark is captured before paging begins and every
 * subsequent page is constrained to that watermark. This prevents new events
 * appended by the active Paper runtime from shifting offset pagination and
 * contaminating a single evidence pass with a moving read boundary.
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
  const snapshotRecordedAt = await readSnapshotRecordedAt(base, runtimeId, key, fetchImpl);
  if (snapshotRecordedAt === null) {
    return {
      runtimeId,
      rows: [],
      pages: 0,
      pageSize,
      truncated: false,
      snapshotRecordedAt: null,
    };
  }

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
    url.searchParams.set('recorded_at', `lte.${snapshotRecordedAt}`);
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
    snapshotRecordedAt,
  };
};
