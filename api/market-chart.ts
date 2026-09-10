import { inflateRawSync } from 'node:zlib';
import type { Candle } from '../src/trading/types';

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const MINUTE = 60_000;
const DAY_UNIT = 1_440;
const WEEK_UNIT = 10_080;
const MONTH_UNIT = 43_200;
const MAX_CHART_UNIT = MONTH_UNIT;
const SEARCH_CACHE_MS = 6 * 60 * 60_000;

const CRYPTO_INTRADAY_UNITS = new Set([1, 3, 5, 10, 15, 30, 60, 240]);
const CRYPTO_HIGHER_UNITS = new Set([DAY_UNIT, WEEK_UNIT, MONTH_UNIT]);
const KRX_INTRADAY_UNITS = new Set([1, 3, 5, 10, 15, 30, 60]);
const KRX_HIGHER_UNITS = new Set([DAY_UNIT, WEEK_UNIT, MONTH_UNIT]);

const KRX_MASTER_URLS = {
  KOSPI: 'https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip',
  KOSDAQ: 'https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip',
} as const;

type SearchMarket = {
  market: string;
  code: string;
  name: string;
  englishName?: string | null;
  assetClass: 'CRYPTO' | 'EQUITY';
  exchange: 'UPBIT' | 'KOSPI' | 'KOSDAQ';
  source: 'UPBIT_PUBLIC' | 'KIS_MASTER';
};

type SearchCache = {
  expiresAt: number;
  items: SearchMarket[];
  errors: string[];
  counts: { crypto: number; kospi: number; kosdaq: number };
};

let searchCache: SearchCache | null = null;

const validCandle = (item: Candle) => Number.isFinite(item.timestamp)
  && item.timestamp > 0
  && Number.isFinite(item.open)
  && Number.isFinite(item.high)
  && Number.isFinite(item.low)
  && Number.isFinite(item.close)
  && item.close > 0
  && Number.isFinite(item.volume);

const aggregateMinuteCandles = (candles: Candle[], unit: number): Candle[] => {
  if (unit === 1) return candles.filter(validCandle);
  const intervalMs = unit * MINUTE;
  const buckets = new Map<number, Candle>();
  for (const candle of candles.filter(validCandle).sort((a, b) => a.timestamp - b.timestamp)) {
    const bucket = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, { ...candle, timestamp: bucket, timeframeMinutes: unit });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
    existing.quoteVolume = (existing.quoteVolume ?? 0) + (candle.quoteVolume ?? 0);
  }
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
};

const kstDateParts = (timestamp: number) => {
  const date = new Date(timestamp + 9 * 60 * MINUTE);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    date: date.getUTCDate(),
    day: date.getUTCDay(),
  };
};

const higherTimeframeKey = (timestamp: number, unit: number) => {
  const parts = kstDateParts(timestamp);
  if (unit === MONTH_UNIT) return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}`;
  if (unit === WEEK_UNIT) {
    const daysSinceMonday = (parts.day + 6) % 7;
    const mondayUtc = Date.UTC(parts.year, parts.month, parts.date - daysSinceMonday);
    const monday = new Date(mondayUtc);
    return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
  }
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.date).padStart(2, '0')}`;
};

const aggregateHigherTimeframeCandles = (candles: Candle[], unit: number): Candle[] => {
  if (unit === DAY_UNIT) return candles.filter(validCandle).map((candle) => ({ ...candle, timeframeMinutes: DAY_UNIT }));
  if (unit !== WEEK_UNIT && unit !== MONTH_UNIT) return [];
  const buckets = new Map<string, Candle>();
  for (const candle of candles.filter(validCandle).sort((a, b) => a.timestamp - b.timestamp)) {
    const key = higherTimeframeKey(candle.timestamp, unit);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...candle, timeframeMinutes: unit });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
    existing.quoteVolume = (existing.quoteVolume ?? 0) + (candle.quoteVolume ?? 0);
  }
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
};

const publicCandle = (item: Candle) => ({
  timestamp: item.timestamp,
  open: item.open,
  high: item.high,
  low: item.low,
  close: item.close,
  volume: item.volume,
});

const cryptoPathForUnit = (unit: number) => {
  if (CRYPTO_INTRADAY_UNITS.has(unit)) return `/v1/candles/minutes/${unit}`;
  if (unit === DAY_UNIT) return '/v1/candles/days';
  if (unit === WEEK_UNIT) return '/v1/candles/weeks';
  if (unit === MONTH_UNIT) return '/v1/candles/months';
  throw new Error('Unsupported Upbit candle unit. Use intraday, daily, weekly, or monthly candles.');
};

const loadCryptoChart = async (market: string, unit: number, count: number) => {
  if (!CRYPTO_INTRADAY_UNITS.has(unit) && !CRYPTO_HIGHER_UNITS.has(unit)) throw new Error('Unsupported Upbit candle unit.');
  const url = new URL(`https://api.upbit.com${cryptoPathForUnit(unit)}`);
  url.searchParams.set('market', market);
  url.searchParams.set('count', String(Math.min(200, count)));
  const result = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'BlackOracle/1.0' },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  });
  if (!result.ok) throw new Error(`Upbit market data returned ${result.status}.`);
  const raw = await result.json() as any[];
  const candles = raw.slice().reverse().map((item) => ({
    market,
    timeframeMinutes: unit,
    timestamp: item?.timestamp ? Number(item.timestamp) : Date.parse(`${String(item?.candle_date_time_utc ?? '')}Z`),
    open: Number(item?.opening_price ?? 0),
    high: Number(item?.high_price ?? 0),
    low: Number(item?.low_price ?? 0),
    close: Number(item?.trade_price ?? 0),
    volume: Number(item?.candle_acc_trade_volume ?? 0),
    quoteVolume: Number(item?.candle_acc_trade_price ?? 0),
  } satisfies Candle)).filter(validCandle);
  return { source: 'UPBIT_PUBLIC' as const, assetClass: 'CRYPTO' as const, configured: true, unit, candles: candles.slice(-count).map(publicCandle) };
};

const krxDailyBarsNeeded = (unit: number, count: number) => {
  if (unit === WEEK_UNIT) return Math.min(1_000, Math.max(200, count * 6));
  if (unit === MONTH_UNIT) return Math.min(1_000, Math.max(260, count * 24));
  return Math.max(200, count);
};

const loadKrxChart = async (market: string, unit: number, count: number) => {
  const configured = Boolean(String(process.env.KIS_APP_KEY ?? '').trim() && String(process.env.KIS_APP_SECRET ?? '').trim());
  if (!configured) {
    return {
      source: 'KIS_OFFICIAL' as const,
      assetClass: 'EQUITY' as const,
      configured: false,
      unit,
      candles: [] as ReturnType<typeof publicCandle>[],
      error: 'KIS market-data credentials are not configured in this deployment.',
    };
  }
  const symbol = market.slice(4);
  const { createKisDomesticStockMarketDataFromEnv } = await import('../server/trading/equity/kisMarketData.js');
  const kis = createKisDomesticStockMarketDataFromEnv();
  if (KRX_HIGHER_UNITS.has(unit)) {
    const daily = (await kis.dailyCandles(symbol, krxDailyBarsNeeded(unit, count))).filter(validCandle);
    const candles = aggregateHigherTimeframeCandles(daily, unit).slice(-count);
    return { source: 'KIS_OFFICIAL' as const, assetClass: 'EQUITY' as const, configured: true, unit, candles: candles.map(publicCandle) };
  }
  if (!KRX_INTRADAY_UNITS.has(unit)) throw new Error('Unsupported KRX candle unit. Use intraday, daily, weekly, or monthly candles.');
  const minuteBarsNeeded = Math.min(300, Math.max(30, count * unit));
  const minuteCandles = await kis.minuteCandles(symbol, minuteBarsNeeded);
  const candles = aggregateMinuteCandles(minuteCandles, unit).slice(-count);
  return { source: 'KIS_OFFICIAL' as const, assetClass: 'EQUITY' as const, configured: true, unit, candles: candles.map(publicCandle) };
};

const unzipFirstFile = (input: Buffer) => {
  const minOffset = Math.max(0, input.length - 65_557);
  let eocd = -1;
  for (let offset = input.length - 22; offset >= minOffset; offset -= 1) {
    if (input.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('KRX master ZIP end record not found.');
  const centralOffset = input.readUInt32LE(eocd + 16);
  let cursor = centralOffset;
  while (cursor + 46 <= input.length && input.readUInt32LE(cursor) === 0x02014b50) {
    const method = input.readUInt16LE(cursor + 10);
    const compressedSize = input.readUInt32LE(cursor + 20);
    const filenameLength = input.readUInt16LE(cursor + 28);
    const extraLength = input.readUInt16LE(cursor + 30);
    const commentLength = input.readUInt16LE(cursor + 32);
    const localOffset = input.readUInt32LE(cursor + 42);
    const filename = input.subarray(cursor + 46, cursor + 46 + filenameLength).toString('utf8');
    if (!filename.endsWith('/')) {
      if (input.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('KRX master ZIP local record is invalid.');
      const localFilenameLength = input.readUInt16LE(localOffset + 26);
      const localExtraLength = input.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localFilenameLength + localExtraLength;
      const compressed = input.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) return inflateRawSync(compressed);
      throw new Error(`Unsupported KRX master ZIP compression method ${method}.`);
    }
    cursor += 46 + filenameLength + extraLength + commentLength;
  }
  throw new Error('KRX master ZIP did not contain a data file.');
};

const parseKrxMaster = (content: Buffer, exchange: 'KOSPI' | 'KOSDAQ'): SearchMarket[] => {
  const decoder = new TextDecoder('euc-kr');
  const rows: SearchMarket[] = [];
  for (const line of content.toString('binary').split('\n')) {
    const bytes = Buffer.from(line, 'binary');
    if (bytes.length < 61) continue;
    let code = decoder.decode(bytes.subarray(0, 9)).trim();
    const name = decoder.decode(bytes.subarray(21, 61)).trim();
    if (code.length > 6) code = code.slice(-6);
    if (!/^\d{6}$/.test(code) || !name) continue;
    rows.push({ market: `KRX-${code}`, code, name, assetClass: 'EQUITY', exchange, source: 'KIS_MASTER' });
  }
  return rows;
};

const loadKrxMaster = async (exchange: 'KOSPI' | 'KOSDAQ') => {
  const response = await fetch(KRX_MASTER_URLS[exchange], {
    headers: { Accept: 'application/zip', 'User-Agent': 'BlackOracle/1.0' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`${exchange} master returned ${response.status}.`);
  const zipped = Buffer.from(await response.arrayBuffer());
  return parseKrxMaster(unzipFirstFile(zipped), exchange);
};

const loadUpbitMarkets = async (): Promise<SearchMarket[]> => {
  const response = await fetch('https://api.upbit.com/v1/market/all?isDetails=false', {
    headers: { Accept: 'application/json', 'User-Agent': 'BlackOracle/1.0' },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Upbit market list returned ${response.status}.`);
  const raw = await response.json() as any[];
  return raw.filter((item) => /^KRW-[A-Z0-9]+$/.test(String(item?.market ?? ''))).map((item) => ({
    market: String(item.market),
    code: String(item.market).slice(4),
    name: String(item.korean_name ?? item.market),
    englishName: item.english_name ? String(item.english_name) : null,
    assetClass: 'CRYPTO' as const,
    exchange: 'UPBIT' as const,
    source: 'UPBIT_PUBLIC' as const,
  }));
};

const loadSearchUniverse = async () => {
  if (searchCache && searchCache.expiresAt > Date.now()) return searchCache;
  const [crypto, kospi, kosdaq] = await Promise.allSettled([loadUpbitMarkets(), loadKrxMaster('KOSPI'), loadKrxMaster('KOSDAQ')]);
  const cryptoItems = crypto.status === 'fulfilled' ? crypto.value : [];
  const kospiItems = kospi.status === 'fulfilled' ? kospi.value : [];
  const kosdaqItems = kosdaq.status === 'fulfilled' ? kosdaq.value : [];
  const errors = [
    crypto.status === 'rejected' ? `UPBIT: ${String(crypto.reason?.message ?? crypto.reason)}` : null,
    kospi.status === 'rejected' ? `KOSPI: ${String(kospi.reason?.message ?? kospi.reason)}` : null,
    kosdaq.status === 'rejected' ? `KOSDAQ: ${String(kosdaq.reason?.message ?? kosdaq.reason)}` : null,
  ].filter((value): value is string => Boolean(value));
  searchCache = {
    expiresAt: Date.now() + SEARCH_CACHE_MS,
    items: [...cryptoItems, ...kospiItems, ...kosdaqItems],
    errors,
    counts: { crypto: cryptoItems.length, kospi: kospiItems.length, kosdaq: kosdaqItems.length },
  };
  return searchCache;
};

const normalized = (value: string) => value.trim().toLocaleLowerCase('ko-KR').replace(/[\s._-]+/g, '');

const searchUniverse = async (query: string, limit: number, assetClass?: string) => {
  const universe = await loadSearchUniverse();
  const q = normalized(query);
  const results = universe.items
    .filter((item) => !assetClass || assetClass === 'ALL' || item.assetClass === assetClass)
    .map((item) => {
      const fields = [item.market, item.code, item.name, item.englishName ?? ''].map(normalized);
      const exact = fields.some((field) => field === q);
      const prefix = fields.some((field) => field.startsWith(q));
      const contains = fields.some((field) => field.includes(q));
      const score = exact ? 0 : prefix ? 1 : contains ? 2 : 99;
      return { item, score };
    })
    .filter((entry) => entry.score < 99)
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, 'ko-KR'))
    .slice(0, limit)
    .map((entry) => entry.item);
  return { universe, results };
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, available: false, error: 'Method not allowed.' });
  }

  const searchMode = String(request.query?.search ?? '') === '1' || request.query?.q != null;
  if (searchMode) {
    response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    const query = String(request.query?.q ?? '').trim().slice(0, 50);
    if (!query) return response.status(200).json({ success: true, mode: 'SEARCH', query, results: [], total: 0 });
    const limit = boundedInt(request.query?.limit, 24, 1, 50);
    const assetClass = String(request.query?.assetClass ?? 'ALL').toUpperCase();
    try {
      const { universe, results } = await searchUniverse(query, limit, assetClass);
      return response.status(200).json({
        success: true,
        mode: 'SEARCH',
        query,
        total: results.length,
        universeSize: universe.items.length,
        coverage: universe.counts,
        partial: universe.errors.length > 0,
        errors: universe.errors,
        results,
      });
    } catch (error) {
      return response.status(200).json({ success: false, mode: 'SEARCH', query, total: 0, results: [], error: error instanceof Error ? error.message : 'Market universe search failed.' });
    }
  }

  response.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
  const market = String(request.query?.market ?? '').trim().toUpperCase();
  const isCrypto = /^KRW-[A-Z0-9]+$/.test(market);
  const isKrx = /^KRX-\d{6}$/.test(market);
  if (!isCrypto && !isKrx) {
    return response.status(400).json({ success: false, available: false, market, error: 'Market must be KRW-<asset> or KRX-<6 digit symbol>.' });
  }

  const defaultUnit = isKrx ? DAY_UNIT : 60;
  const unit = boundedInt(request.query?.unit, defaultUnit, 1, MAX_CHART_UNIT);
  const count = boundedInt(request.query?.count, isKrx ? 60 : 48, 12, 120);
  try {
    const chart = isCrypto ? await loadCryptoChart(market, unit, count) : await loadKrxChart(market, unit, count);
    return response.status(200).json({
      success: true,
      available: chart.candles.length >= 2,
      market,
      source: chart.source,
      assetClass: chart.assetClass,
      configured: chart.configured,
      unit: chart.unit,
      count: chart.candles.length,
      asOf: chart.candles.length ? chart.candles[chart.candles.length - 1]?.timestamp ?? null : null,
      candles: chart.candles,
      ...('error' in chart && chart.error ? { error: chart.error } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown market data error.';
    return response.status(200).json({ success: true, available: false, market, configured: isCrypto ? true : undefined, error: message });
  }
}
