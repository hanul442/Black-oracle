import { buildKrwLiquidityUniverse } from '../server/trading/universe';
import { getMinuteCandles } from '../server/trading/upbitPublic';
import { buildTradingSnapshot } from '../src/trading/snapshot';

const market = (process.argv[2] ?? 'KRW-BTC').toUpperCase();
const unit = 60 as const;

const [candles, universe] = await Promise.all([
  getMinuteCandles(market, unit, 200),
  buildKrwLiquidityUniverse(8, 30),
]);
const snapshot = buildTradingSnapshot(candles);

console.log(JSON.stringify({
  market: snapshot.market,
  asOf: new Date(snapshot.asOf).toISOString(),
  regime: snapshot.regime,
  trend: snapshot.trend,
  momentum: snapshot.momentum,
  overboughtOversold: snapshot.meanReversion,
  fusion: snapshot.fusion,
  indicators: {
    close: snapshot.indicators.close,
    rsi14: snapshot.indicators.rsi14,
    stochRsi14: snapshot.indicators.stochRsi14,
    bollingerPercentB: snapshot.indicators.bollingerPercentB,
    atrPct: snapshot.indicators.atrPct,
    macdHistogram: snapshot.indicators.macdHistogram,
    roc20: snapshot.indicators.roc20,
  },
  liquidityUniverse: universe.map((item) => ({
    market: item.market,
    eligible: item.eligible,
    score: item.score,
    spreadBps: Number(item.spreadBps.toFixed(2)),
    turnover24hKrw: item.accTradePrice24h,
  })),
}, null, 2));
