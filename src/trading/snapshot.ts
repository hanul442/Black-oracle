import { buildIndicatorSnapshot } from './indicators';
import { buildMeanReversionSignal } from './meanReversion';
import { classifyRegime } from './regime';
import { buildSignalFusion } from './signalFusion';
import { buildMomentumSignal, buildTrendSignal } from './trendMomentum';
import type { Candle, TradingSnapshot } from './types';

export const buildTradingSnapshot = (candles: Candle[], eventScore?: number): TradingSnapshot => {
  if (candles.length === 0) throw new Error('At least one candle is required.');
  const ordered = candles.slice().sort((a, b) => a.timestamp - b.timestamp);
  const latest = ordered[ordered.length - 1];
  const indicators = buildIndicatorSnapshot(ordered);
  const regime = classifyRegime(indicators);
  const trend = buildTrendSignal(indicators, regime);
  const momentum = buildMomentumSignal(indicators);
  const meanReversion = buildMeanReversionSignal(indicators, regime);
  const fusion = buildSignalFusion(trend, momentum, meanReversion, regime, eventScore);

  return {
    market: latest.market,
    timeframeMinutes: latest.timeframeMinutes,
    candleCount: ordered.length,
    asOf: latest.timestamp,
    indicators,
    regime,
    trend,
    momentum,
    meanReversion,
    fusion,
  };
};
