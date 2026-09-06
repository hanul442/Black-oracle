import { SUPPORTED_UPBIT_MINUTE_UNITS, type SupportedUpbitMinuteUnit } from '../../src/trading/config';
import type { Candle } from '../../src/trading/types';

const UPBIT_API_BASE = 'https://api.upbit.com';
const MAX_CANDLES_PER_REQUEST = 200;
const MAX_PAGINATED_CANDLES = 1_000;

interface UpbitMarketResponse {
  market: string;
  korean_name: string;
  english_name: string;
  market_event?: {
    warning?: boolean;
    caution?: Record<string, boolean>;
  };
}

interface UpbitMinuteCandleResponse {
  market: string;
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  timestamp: number;
  candle_acc_trade_price: number;
  candle_acc_trade_volume: number;
  unit: number;
}

interface UpbitTickerResponse {
  market: string;
  trade_price: number;
  signed_change_rate: number;
  acc_trade_price_24h: number;
  acc_trade_volume_24h: number;
  timestamp: number;
}

interface UpbitOrderbookResponse {
  market: string;
  timestamp: number;
  total_ask_size: number;
  total_bid_size: number;
  orderbook_units: Array<{
    ask_price: number;
    bid_price: number;
    ask_size: number;
    bid_size: number;
  }>;
}

const getJson = async <T>(url: URL): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Black-Oracle-Trading/0.1',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upbit public API ${response.status}: ${body.slice(0, 240)}`);
  }

  return response.json() as Promise<T>;
};

const assertKrwMarket = (market: string) => {
  if (!/^KRW-[A-Z0-9]+$/.test(market)) throw new Error('Only normalized KRW Upbit markets are allowed in v0.1.');
};

const assertMinuteUnit = (unit: SupportedUpbitMinuteUnit) => {
  if (!SUPPORTED_UPBIT_MINUTE_UNITS.includes(unit)) throw new Error(`Unsupported Upbit minute unit: ${unit}`);
};

const assertCount = (count: number, max: number, label: string) => {
  if (!Number.isInteger(count) || count < 1 || count > max) {
    throw new Error(`${label} must be an integer between 1 and ${max}.`);
  }
};

const assertExclusiveCursor = (to?: string) => {
  if (to == null) return;
  if (!to.trim() || !Number.isFinite(Date.parse(to))) throw new Error('Upbit candle to cursor must be a valid ISO-8601 timestamp.');
};

export const listKrwMarkets = async () => {
  const url = new URL('/v1/market/all', UPBIT_API_BASE);
  url.searchParams.set('is_details', 'true');
  const markets = await getJson<UpbitMarketResponse[]>(url);

  return markets
    .filter((item) => item.market.startsWith('KRW-'))
    .map((item) => ({
      market: item.market,
      koreanName: item.korean_name,
      englishName: item.english_name,
      warning: Boolean(item.market_event?.warning),
      caution: item.market_event?.caution ?? {},
    }));
};

export const getKrwTickers = async () => {
  const url = new URL('/v1/ticker/all', UPBIT_API_BASE);
  url.searchParams.set('quote_currencies', 'KRW');
  const tickers = await getJson<UpbitTickerResponse[]>(url);
  return tickers.map((ticker) => ({
    market: ticker.market,
    tradePrice: ticker.trade_price,
    signedChangeRate: ticker.signed_change_rate,
    accTradePrice24h: ticker.acc_trade_price_24h,
    accTradeVolume24h: ticker.acc_trade_volume_24h,
    timestamp: ticker.timestamp,
  }));
};

export const getOrderbooks = async (markets: string[]) => {
  const normalized = [...new Set(markets.map((market) => market.toUpperCase()))];
  if (normalized.length === 0) return [];
  if (normalized.length > 30) throw new Error('Orderbook batch is limited to 30 markets in Black Oracle v0.1.');
  normalized.forEach(assertKrwMarket);

  const url = new URL('/v1/orderbook', UPBIT_API_BASE);
  url.searchParams.set('markets', normalized.join(','));
  const orderbooks = await getJson<UpbitOrderbookResponse[]>(url);

  return orderbooks.map((book) => ({
    market: book.market,
    timestamp: book.timestamp,
    totalAskSize: book.total_ask_size,
    totalBidSize: book.total_bid_size,
    units: book.orderbook_units.map((unit) => ({
      askPrice: unit.ask_price,
      bidPrice: unit.bid_price,
      askSize: unit.ask_size,
      bidSize: unit.bid_size,
    })),
  }));
};

export interface MinuteCandleRequestOptions {
  /** Upbit's exclusive end cursor. Candles strictly before this UTC timestamp are returned. */
  to?: string;
}

export const getMinuteCandles = async (
  market: string,
  unit: SupportedUpbitMinuteUnit,
  count = MAX_CANDLES_PER_REQUEST,
  options: MinuteCandleRequestOptions = {},
): Promise<Candle[]> => {
  assertKrwMarket(market);
  assertMinuteUnit(unit);
  assertCount(count, MAX_CANDLES_PER_REQUEST, 'Candle count');
  assertExclusiveCursor(options.to);

  const url = new URL(`/v1/candles/minutes/${unit}`, UPBIT_API_BASE);
  url.searchParams.set('market', market);
  url.searchParams.set('count', String(count));
  if (options.to) url.searchParams.set('to', options.to);

  const raw = await getJson<UpbitMinuteCandleResponse[]>(url);
  return raw
    .map((candle) => ({
      market: candle.market,
      timeframeMinutes: candle.unit,
      timestamp: Date.parse(`${candle.candle_date_time_utc}Z`),
      open: candle.opening_price,
      high: candle.high_price,
      low: candle.low_price,
      close: candle.trade_price,
      volume: candle.candle_acc_trade_volume,
      quoteVolume: candle.candle_acc_trade_price,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

export interface MinuteCandlePageRequest {
  market: string;
  unit: SupportedUpbitMinuteUnit;
  count: number;
  to?: string;
}

export type MinuteCandlePageReader = (request: MinuteCandlePageRequest) => Promise<Candle[]>;

/**
 * Deterministically stitch Upbit's <=200-candle pages into one ascending history.
 * Duplicate page-boundary timestamps fail closed instead of being silently deduplicated.
 */
export const paginateMinuteCandleHistory = async (
  request: MinuteCandlePageRequest,
  pageReader: MinuteCandlePageReader,
): Promise<Candle[]> => {
  assertKrwMarket(request.market);
  assertMinuteUnit(request.unit);
  assertCount(request.count, MAX_PAGINATED_CANDLES, 'Paginated candle count');
  assertExclusiveCursor(request.to);

  const collected: Candle[] = [];
  const seen = new Set<number>();
  let cursor = request.to;

  while (collected.length < request.count) {
    const remaining = request.count - collected.length;
    const pageSize = Math.min(MAX_CANDLES_PER_REQUEST, remaining);
    const page = await pageReader({ market: request.market, unit: request.unit, count: pageSize, to: cursor });
    if (!Array.isArray(page) || page.length === 0) break;
    if (page.length > pageSize) throw new Error(`Upbit candle page exceeded requested size ${pageSize}.`);

    for (const candle of page) {
      if (seen.has(candle.timestamp)) {
        throw new Error(`Duplicate candle timestamp ${candle.timestamp} crossed an Upbit pagination boundary.`);
      }
      seen.add(candle.timestamp);
      collected.push(candle);
    }

    if (page.length < pageSize || collected.length >= request.count) break;
    const earliestTimestamp = page.reduce((minimum, candle) => Math.min(minimum, candle.timestamp), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(earliestTimestamp) || earliestTimestamp <= 0) {
      throw new Error('Cannot continue Upbit candle pagination from an invalid page timestamp.');
    }
    cursor = new Date(earliestTimestamp).toISOString();
  }

  return collected
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-request.count);
};

export const getMinuteCandleHistory = async (
  market: string,
  unit: SupportedUpbitMinuteUnit,
  count = 400,
  options: MinuteCandleRequestOptions = {},
): Promise<Candle[]> => paginateMinuteCandleHistory(
  { market, unit, count, to: options.to },
  ({ market: pageMarket, unit: pageUnit, count: pageCount, to }) => getMinuteCandles(pageMarket, pageUnit, pageCount, { to }),
);
