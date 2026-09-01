import { buildTradingSnapshot } from '../src/trading/snapshot';
import { getMinuteCandles } from '../server/trading/upbitPublic';

const market = (process.argv[2] ?? 'KRW-BTC').toUpperCase();
const unit = 60 as const;

const candles = await getMinuteCandles(market, unit, 200);
const snapshot = buildTradingSnapshot(candles);

console.log(JSON.stringify({
  market: snapshot.market,
  asOf: new Date(snapshot.asOf).toISOString(),
  regime: snapshot.regime,
  overboughtOversold: snapshot.meanReversion,
  indicators: {
    close: snapshot.indicators.close,
    rsi14: snapshot.indicators.rsi14,
    stochRsi14: snapshot.indicators.stochRsi14,
    bollingerPercentB: snapshot.indicators.bollingerPercentB,
    atrPct: snapshot.indicators.atrPct,
    macdHistogram: snapshot.indicators.macdHistogram,
  },
}, null, 2));
