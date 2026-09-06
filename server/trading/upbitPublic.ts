import { SUPPORTED_UPBIT_MINUTE_UNITS, type SupportedUpbitMinuteUnit } from '../../src/trading/config';
import type { Candle } from '../../src/trading/types';
import type { TradePrint } from '../../src/trading/volumeProfile';

const UPBIT_API_BASE = 'https://api.upbit.com';

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

interface UpbitTradeResponse {
  market: string;
  timestamp: number;
  trade_price: number;
  trade_volume: number;
  ask_bid: 'ASK' | 'BID';
  sequential_id: number;
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

export const getRecentTrades = async (market: string, count = 500): Promise<TradePrint[]> => {
  const normalized = market.toUpperCase();
  assertKrwMarket(normalized);
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('Recent trade count must be an integer between 1 and 500.');

  const url = new URL('/v1/trades/ticks', UPBIT_API_BASE);
  url.searchParams.set('market', normalized);
  url.searchParams.set('count', String(count));
  const trades = await getJson<UpbitTradeResponse[]>(url);

  return trades
    .map((trade) => ({
      market: trade.market,
      timestamp: trade.timestamp,
      price: trade.trade_price,
      volume: trade.trade_volume,
      side: trade.ask_bid,
      sequentialId: String(trade.sequential_id),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

export const getOrderbooks = async (markets: string[]) => {
  const normalized = [...new Set(markets.map((market) => market.toUpperCase()))];
  if (normalized.length === 0) return [];
  if (normalized.length > 30) throw new Error('Orderbook batch is limited to 30 markets in Black Oracle v0.1.');
  normalized.forEach(assertKrwMarket);

  const url = new URL('/v1/orderbook', UPBIT_API_BASE);
  url.searchParams.set('markets', normalized.join(','));
  url.searchParams.set('count', '30');
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

export const getMinuteCandles = async (
  market: string,
  unit: SupportedUpbitMinuteUnit,
  count = 200,
): Promise<Candle[]> => {
  assertKrwMarket(market);
  if (!SUPPORTED_UPBIT_MINUTE_UNITS.includes(unit)) throw new Error(`Unsupported Upbit minute unit: ${unit}`);
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error('Candle count must be an integer between 1 and 200.');

  const url = new URL(`/v1/candles/minutes/${unit}`, UPBIT_API_BASE);
  url.searchParams.set('market', market);
  url.searchParams.set('count', String(count));

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
