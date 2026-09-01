import { SUPPORTED_UPBIT_MINUTE_UNITS, type SupportedUpbitMinuteUnit } from '../../src/trading/config';
import type { Candle } from '../../src/trading/types';

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

export const getMinuteCandles = async (
  market: string,
  unit: SupportedUpbitMinuteUnit,
  count = 200,
): Promise<Candle[]> => {
  if (!/^KRW-[A-Z0-9]+$/.test(market)) throw new Error('Only normalized KRW Upbit markets are allowed in v0.1.');
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
