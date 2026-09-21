const DEFAULT_LSE_VAULT_URL = 'https://api.londonstrategicedge.com/vault';
const DEFAULT_TIMEOUT_MS = 20_000;

export type LseCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframeMinutes: number;
};

export type LseMarketDataTruth = {
  provider: 'LONDON_STRATEGIC_EDGE';
  source: 'LSE_VAULT_REST';
  quality: 'LIVE' | 'EOD' | 'DELAYED' | 'UNAVAILABLE';
  observedAt: number | null;
  receivedAt: number;
  freshnessAgeMinutes: number | null;
  delayMinutes: number | null;
  executionEligible: false;
  researchOnly: true;
  redistributionAllowed: false;
  reason: string;
};

const TIMEFRAME_BY_MINUTES = new Map<number, string>([
  [1, '1m'],
  [3, '3m'],
  [5, '5m'],
  [15, '15m'],
  [30, '30m'],
  [60, '1h'],
  [240, '4h'],
  [1_440, '1d'],
  [10_080, '1w'],
  [43_200, '1mo'],
]);

const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const timestampMs = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1_000;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const lseConfigured = () => Boolean(String(process.env.LSE_API_KEY ?? '').trim());

export const lseTimeframeForMinutes = (minutes: number) => TIMEFRAME_BY_MINUTES.get(minutes) ?? null;

export const buildLseUrl = (path: string, params: Record<string, unknown> = {}) => {
  const base = String(process.env.LSE_VAULT_URL || DEFAULT_LSE_VAULT_URL).replace(/\/$/, '');
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
};

export const normalizeLseCandles = (rows: unknown[], timeframeMinutes: number): LseCandle[] => rows
  .map((raw) => {
    const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const timestamp = timestampMs(row.timestamp ?? row.ts);
    const open = numeric(row.open);
    const high = numeric(row.high);
    const low = numeric(row.low);
    const close = numeric(row.close);
    const volume = numeric(row.volume) ?? 0;
    if (timestamp == null || open == null || high == null || low == null || close == null) return null;
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return null;
    return { timestamp, open, high, low, close, volume, timeframeMinutes };
  })
  .filter((item): item is LseCandle => item !== null)
  .sort((a, b) => a.timestamp - b.timestamp);

export async function loadLseRows(
  path: string,
  params: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch,
) {
  const apiKey = String(process.env.LSE_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('LSE_API_KEY is not configured.');

  const timeoutRaw = Number(process.env.LSE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutRaw) ? Math.max(1_000, Math.min(120_000, timeoutRaw)) : DEFAULT_TIMEOUT_MS;
  const url = buildLseUrl(path, params);

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'User-Agent': 'black-oracle-market-data/1.0',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`LSE ${response.status}: ${text.slice(0, 300) || response.statusText}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('LSE returned a non-JSON response.');
  }
}

const truthFor = (candles: LseCandle[], timeframeMinutes: number, receivedAt: number): LseMarketDataTruth => {
  const observedAt = candles.at(-1)?.timestamp ?? null;
  const freshnessAgeMinutes = observedAt == null ? null : Math.max(0, (receivedAt - observedAt) / 60_000);
  const dailyOrHigher = timeframeMinutes >= 1_440;
  const freshThreshold = Math.max(15, timeframeMinutes * 2);
  const quality: LseMarketDataTruth['quality'] = observedAt == null
    ? 'UNAVAILABLE'
    : dailyOrHigher
      ? 'EOD'
      : freshnessAgeMinutes != null && freshnessAgeMinutes <= freshThreshold
        ? 'LIVE'
        : 'DELAYED';

  return {
    provider: 'LONDON_STRATEGIC_EDGE',
    source: 'LSE_VAULT_REST',
    quality,
    observedAt,
    receivedAt,
    freshnessAgeMinutes,
    delayMinutes: quality === 'DELAYED' ? freshnessAgeMinutes : null,
    executionEligible: false,
    researchOnly: true,
    redistributionAllowed: false,
    reason: observedAt == null
      ? 'LSE returned no usable candles. Missing prices are not inferred.'
      : 'LSE Vault REST data is accepted for internal research and model inputs only. Execution authority requires a separately qualified live feed; bulk redistribution is disabled.',
  };
};

export async function loadLseCandles(options: {
  symbol: string;
  timeframeMinutes: number;
  count?: number;
  dataset?: string;
  start?: string;
  end?: string;
  fetchImpl?: typeof fetch;
}) {
  const timeframe = lseTimeframeForMinutes(options.timeframeMinutes);
  if (!timeframe) {
    throw new Error(`Unsupported LSE timeframe: ${options.timeframeMinutes} minutes.`);
  }

  const symbol = options.symbol.trim().toUpperCase();
  if (!symbol) throw new Error('LSE symbol is required.');
  const limit = Math.max(2, Math.min(5_000, Math.trunc(options.count ?? 120)));

  const payload = await loadLseRows('/candles', {
    symbol,
    timeframe,
    order: 'desc',
    limit,
    dataset: options.dataset?.trim() || undefined,
    start: options.start,
    end: options.end,
  }, options.fetchImpl);

  const rows = Array.isArray(payload) ? payload : [];
  const candles = normalizeLseCandles(rows, options.timeframeMinutes);
  const receivedAt = Date.now();

  return {
    provider: 'LONDON_STRATEGIC_EDGE' as const,
    source: 'LSE_VAULT_REST' as const,
    symbol,
    dataset: options.dataset?.trim() || null,
    timeframe,
    candles,
    truth: truthFor(candles, options.timeframeMinutes, receivedAt),
  };
}

export async function loadLseSeries(options: {
  symbol: string;
  dataset?: string;
  start?: string;
  end?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  fetchImpl?: typeof fetch;
}) {
  const symbol = options.symbol.trim();
  if (!symbol) throw new Error('LSE series symbol is required.');
  const limit = Math.max(1, Math.min(5_000, Math.trunc(options.limit ?? 500)));
  const payload = await loadLseRows('/series', {
    symbol,
    dataset: options.dataset?.trim() || undefined,
    start: options.start,
    end: options.end,
    order: options.order ?? 'desc',
    limit,
  }, options.fetchImpl);
  return Array.isArray(payload) ? payload : [];
}

export async function loadLseMeta(fetchImpl: typeof fetch = fetch) {
  return loadLseRows('/meta', {}, fetchImpl);
}

export async function loadLseUsage(fetchImpl: typeof fetch = fetch) {
  return loadLseRows('/usage', {}, fetchImpl);
}
