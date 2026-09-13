import type { Candle } from '../../../src/trading/types';
import { delayedResearchProvenance, evaluateMarketDataSuitability, type MarketDataProvenance } from '../marketDataProvider';

const MINUTE = 60_000;
const DAY = 1_440;
const WEEK = 10_080;
const MONTH = 43_200;
const YAHOO_KRX_DELAY_MINUTES = 20;

export interface YahooKrxChartResult {
  market: string;
  yahooSymbol: string;
  candles: Candle[];
  provenance: MarketDataProvenance;
  executionAllowed: false;
  researchIntradayAllowed: boolean;
}

const finite = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const validCandle = (item: Candle) => Number.isFinite(item.timestamp)
  && item.timestamp > 0
  && Number.isFinite(item.open)
  && Number.isFinite(item.high)
  && Number.isFinite(item.low)
  && Number.isFinite(item.close)
  && item.close > 0
  && Number.isFinite(item.volume);

const intradayAggregate = (candles: Candle[], unit: number) => {
  if (candles.length === 0) return [];
  const intervalMs = unit * MINUTE;
  const buckets = new Map<number, Candle>();
  for (const candle of candles.slice().sort((a, b) => a.timestamp - b.timestamp)) {
    const timestamp = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    const existing = buckets.get(timestamp);
    if (!existing) {
      buckets.set(timestamp, { ...candle, timestamp, timeframeMinutes: unit });
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

const kstParts = (timestamp: number) => {
  const value = new Date(timestamp + 9 * 60 * MINUTE);
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth(),
    date: value.getUTCDate(),
    weekday: value.getUTCDay(),
  };
};

const higherKey = (timestamp: number, unit: number) => {
  const parts = kstParts(timestamp);
  if (unit === MONTH) return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}`;
  if (unit === WEEK) {
    const daysSinceMonday = (parts.weekday + 6) % 7;
    const monday = new Date(Date.UTC(parts.year, parts.month, parts.date - daysSinceMonday));
    return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
  }
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.date).padStart(2, '0')}`;
};

const higherAggregate = (candles: Candle[], unit: number) => {
  if (unit === DAY) return candles.map((item) => ({ ...item, timeframeMinutes: DAY }));
  const buckets = new Map<string, Candle>();
  for (const candle of candles.slice().sort((a, b) => a.timestamp - b.timestamp)) {
    const key = higherKey(candle.timestamp, unit);
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

export const yahooSymbolsForKrx = (symbol: string) => {
  if (!/^\d{6}$/.test(symbol)) throw new Error('Yahoo KRX fallback requires a six-digit KRX symbol.');
  return [`${symbol}.KS`, `${symbol}.KQ`] as const;
};

export const parseYahooChartPayload = (
  payload: any,
  market: string,
  timeframeMinutes: number,
): { yahooSymbol: string; candles: Candle[] } => {
  const result = payload?.chart?.result?.[0];
  if (!result || payload?.chart?.error) throw new Error(String(payload?.chart?.error?.description ?? 'Yahoo chart returned no result.'));
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] ?? {};
  const opens = Array.isArray(quote.open) ? quote.open : [];
  const highs = Array.isArray(quote.high) ? quote.high : [];
  const lows = Array.isArray(quote.low) ? quote.low : [];
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const volumes = Array.isArray(quote.volume) ? quote.volume : [];
  const yahooSymbol = String(result?.meta?.symbol ?? '');

  const candles = timestamps.map((seconds: unknown, index: number) => ({
    market,
    timeframeMinutes,
    timestamp: Number(seconds) * 1_000,
    open: finite(opens[index]) ?? 0,
    high: finite(highs[index]) ?? 0,
    low: finite(lows[index]) ?? 0,
    close: finite(closes[index]) ?? 0,
    volume: finite(volumes[index]) ?? 0,
  } satisfies Candle)).filter(validCandle);

  if (!candles.length) throw new Error('Yahoo chart returned no valid OHLCV candles.');
  return { yahooSymbol, candles };
};

const yahooBaseRequest = (unit: number) => {
  if (unit <= 3) return { interval: '1m', baseUnit: 1, range: '7d' };
  if (unit <= 60) return { interval: '5m', baseUnit: 5, range: '60d' };
  return { interval: '1d', baseUnit: DAY, range: unit === MONTH ? '5y' : '2y' };
};

const loadYahooSymbol = async (yahooSymbol: string, market: string, unit: number) => {
  const request = yahooBaseRequest(unit);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set('interval', request.interval);
  url.searchParams.set('range', request.range);
  url.searchParams.set('includePrePost', 'false');
  url.searchParams.set('events', 'div,splits');
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 BlackOracle/1.0 research-fallback',
    },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Yahoo chart ${yahooSymbol} returned ${response.status}.`);
  const parsed = parseYahooChartPayload(await response.json(), market, request.baseUnit);
  const aggregated = unit <= 60
    ? intradayAggregate(parsed.candles, unit)
    : higherAggregate(parsed.candles, unit);
  return { yahooSymbol: parsed.yahooSymbol || yahooSymbol, candles: aggregated };
};

/**
 * Account-free KRX fallback for research/display only.
 * Yahoo marks Korea Exchange quotes as delayed; Black Oracle therefore refuses
 * to grant this source any intraday execution authority.
 */
export const loadYahooKrxCandles = async (
  symbol: string,
  unit: number,
  count: number,
): Promise<YahooKrxChartResult> => {
  if (![1, 3, 5, 10, 15, 30, 60, DAY, WEEK, MONTH].includes(unit)) {
    throw new Error('Unsupported Yahoo KRX candle unit.');
  }
  const market = `KRX-${symbol}`;
  const errors: string[] = [];
  for (const yahooSymbol of yahooSymbolsForKrx(symbol)) {
    try {
      const loaded = await loadYahooSymbol(yahooSymbol, market, unit);
      const candles = loaded.candles.slice(-Math.max(2, count));
      const observedAt = candles.at(-1)?.timestamp ?? null;
      const provenance = delayedResearchProvenance(
        'YAHOO_FINANCE',
        loaded.yahooSymbol,
        observedAt,
        Date.now(),
        YAHOO_KRX_DELAY_MINUTES,
      );
      return {
        market,
        yahooSymbol: loaded.yahooSymbol,
        candles,
        provenance,
        executionAllowed: false,
        researchIntradayAllowed: evaluateMarketDataSuitability(provenance, 'RESEARCH_INTRADAY').allowed,
      };
    } catch (error) {
      errors.push(`${yahooSymbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Yahoo KRX fallback failed for ${symbol}. ${errors.join(' | ')}`);
};
