import { evaluateLiquidity } from '../../src/trading/liquidity';
import type { LiquiditySnapshot } from '../../src/trading/types';
import { getKrwTickers, getOrderbooks, listKrwMarkets } from './upbitPublic';

const top5Depth = (units: Array<{ bidPrice: number; askPrice: number; bidSize: number; askSize: number }>) => {
  const top = units.slice(0, 5);
  return {
    bid: top.reduce((sum, unit) => sum + unit.bidPrice * unit.bidSize, 0),
    ask: top.reduce((sum, unit) => sum + unit.askPrice * unit.askSize, 0),
  };
};

export const getMarketLiquidity = async (market: string): Promise<LiquiditySnapshot> => {
  const normalized = market.toUpperCase();
  const [metadata, tickers, orderbooks] = await Promise.all([
    listKrwMarkets(),
    getKrwTickers(),
    getOrderbooks([normalized]),
  ]);
  const ticker = tickers.find((item) => item.market === normalized);
  const orderbook = orderbooks.find((item) => item.market === normalized);
  if (!ticker || !orderbook || orderbook.units.length === 0) throw new Error(`No public liquidity snapshot available for ${normalized}.`);

  const marketMetadata = metadata.find((item) => item.market === normalized);
  const best = orderbook.units[0];
  const depth = top5Depth(orderbook.units);
  return evaluateLiquidity({
    market: normalized,
    tradePrice: ticker.tradePrice,
    accTradePrice24h: ticker.accTradePrice24h,
    signedChangeRate: ticker.signedChangeRate,
    bestBid: best.bidPrice,
    bestAsk: best.askPrice,
    top5BidDepthKrw: depth.bid,
    top5AskDepthKrw: depth.ask,
    warning: marketMetadata?.warning ?? false,
  });
};

export const buildKrwLiquidityUniverse = async (
  limit = 12,
  candidateCount = 30,
): Promise<LiquiditySnapshot[]> => {
  const [marketMetadata, tickers] = await Promise.all([listKrwMarkets(), getKrwTickers()]);
  const warnings = new Map(marketMetadata.map((item) => [item.market, item.warning]));

  const candidates = tickers
    .filter((ticker) => ticker.market.startsWith('KRW-'))
    .sort((a, b) => b.accTradePrice24h - a.accTradePrice24h)
    .slice(0, Math.max(limit, candidateCount));

  const orderbooks = await getOrderbooks(candidates.map((ticker) => ticker.market));
  const orderbookByMarket = new Map(orderbooks.map((book) => [book.market, book]));

  const ranked = candidates
    .map((ticker) => {
      const orderbook = orderbookByMarket.get(ticker.market);
      if (!orderbook || orderbook.units.length === 0) return null;
      const best = orderbook.units[0];
      const depth = top5Depth(orderbook.units);
      return evaluateLiquidity({
        market: ticker.market,
        tradePrice: ticker.tradePrice,
        accTradePrice24h: ticker.accTradePrice24h,
        signedChangeRate: ticker.signedChangeRate,
        bestBid: best.bidPrice,
        bestAsk: best.askPrice,
        top5BidDepthKrw: depth.bid,
        top5AskDepthKrw: depth.ask,
        warning: warnings.get(ticker.market) ?? false,
      });
    })
    .filter((item): item is LiquiditySnapshot => Boolean(item))
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.score - a.score;
    });

  return ranked.slice(0, limit);
};
