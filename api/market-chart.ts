import type { Candle } from '../src/trading/types';

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const MINUTE = 60_000;
const DAY_UNIT = 1_440;
const WEEK_UNIT = 10_080;
const MONTH_UNIT = 43_200; // API contract value for a calendar-month frame; aggregation itself is calendar based.
const MAX_CHART_UNIT = MONTH_UNIT;

const CRYPTO_INTRADAY_UNITS = new Set([1, 3, 5, 10, 15, 30, 60, 240]);
const CRYPTO_HIGHER_UNITS = new Set([DAY_UNIT, WEEK_UNIT, MONTH_UNIT]);
const KRX_INTRADAY_UNITS = new Set([1, 3, 5, 10, 15, 30, 60]);
const KRX_HIGHER_UNITS = new Set([DAY_UNIT, WEEK_UNIT, MONTH_UNIT]);

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
  if (!CRYPTO_INTRADAY_UNITS.has(unit) && !CRYPTO_HIGHER_UNITS.has(unit)) {
    throw new Error('Unsupported Upbit candle unit.');
  }
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
  return {
    source: 'UPBIT_PUBLIC' as const,
    assetClass: 'CRYPTO' as const,
    configured: true,
    unit,
    candles: candles.slice(-count).map(publicCandle),
  };
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

  if (!KRX_INTRADAY_UNITS.has(unit)) {
    throw new Error('Unsupported KRX candle unit. Use intraday, daily, weekly, or monthly candles.');
  }
  const minuteBarsNeeded = Math.min(300, Math.max(30, count * unit));
  const minuteCandles = await kis.minuteCandles(symbol, minuteBarsNeeded);
  const candles = aggregateMinuteCandles(minuteCandles, unit).slice(-count);
  return { source: 'KIS_OFFICIAL' as const, assetClass: 'EQUITY' as const, configured: true, unit, candles: candles.map(publicCandle) };
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, available: false, error: 'Method not allowed.' });
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
    const chart = isCrypto
      ? await loadCryptoChart(market, unit, count)
      : await loadKrxChart(market, unit, count);
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
