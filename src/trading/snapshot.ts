import { buildIndicatorSnapshot } from './indicators';
import { buildMeanReversionSignal } from './meanReversion';
import { classifyRegime } from './regime';
import type { Candle, TradingSnapshot } from './types';

export const buildTradingSnapshot = (candles: Candle[]): TradingSnapshot => {
  if (candles.length === 0) throw new Error('At least one candle is required.');
  const ordered = candles.slice().sort((a, b) => a.timestamp - b.timestamp);
  const latest = ordered[ordered.length - 1];
  const indicators = buildIndicatorSnapshot(ordered);
  const regime = classifyRegime(indicators);
  const meanReversion = buildMeanReversionSignal(indicators, regime);

  return {
    market: latest.market,
    timeframeMinutes: latest.timeframeMinutes,
    candleCount: ordered.length,
    asOf: latest.timestamp,
    indicators,
    regime,
    meanReversion,
  };
};
