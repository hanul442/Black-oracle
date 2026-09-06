import { buildIndicatorSnapshot } from './indicators';
import type { Candle, IndicatorSnapshot } from './types';

export type WarmupStabilityDisposition = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface WarmupStabilityOptions {
  windows?: number[];
  watchThreshold?: number;
  rejectThreshold?: number;
}

export interface WarmupStabilityWindow {
  candles: number;
  maxNormalizedDrift: number;
  indicatorDrift: Record<string, number>;
}

export interface WarmupStabilityResult {
  disposition: WarmupStabilityDisposition;
  baselineCandles: number | null;
  comparedWindows: WarmupStabilityWindow[];
  maxNormalizedDrift: number | null;
  reasons: string[];
  provenance: {
    method: 'SAME_TERMINAL_CANDLE_VARYING_WARMUP';
    minimumIndicatorCandles: 200;
    terminalTimestampHeldConstant: true;
    futureDataUsed: false;
  };
}

const finite = (value: number) => Number.isFinite(value) ? value : 0;
const relativeToClose = (candidate: number, baseline: number, close: number) => Math.abs(finite(candidate) - finite(baseline)) / Math.max(Math.abs(close), 1e-12);
const absoluteScaled = (candidate: number, baseline: number, scale: number) => Math.abs(finite(candidate) - finite(baseline)) / scale;

const driftMap = (candidate: IndicatorSnapshot, baseline: IndicatorSnapshot): Record<string, number> => {
  const close = baseline.close;
  return {
    ema20: relativeToClose(candidate.ema20, baseline.ema20, close),
    ema50: relativeToClose(candidate.ema50, baseline.ema50, close),
    ema200: relativeToClose(candidate.ema200, baseline.ema200, close),
    atr14: relativeToClose(candidate.atr14, baseline.atr14, close),
    macd: relativeToClose(candidate.macd, baseline.macd, close),
    macdSignal: relativeToClose(candidate.macdSignal, baseline.macdSignal, close),
    macdHistogram: relativeToClose(candidate.macdHistogram, baseline.macdHistogram, close),
    bollingerMiddle: relativeToClose(candidate.bollingerMiddle, baseline.bollingerMiddle, close),
    bollingerUpper: relativeToClose(candidate.bollingerUpper, baseline.bollingerUpper, close),
    bollingerLower: relativeToClose(candidate.bollingerLower, baseline.bollingerLower, close),
    rsi14: absoluteScaled(candidate.rsi14, baseline.rsi14, 100),
    stochRsi14: absoluteScaled(candidate.stochRsi14, baseline.stochRsi14, 100),
    roc20: Math.abs(finite(candidate.roc20) - finite(baseline.roc20)),
    bollingerPercentB: Math.abs(finite(candidate.bollingerPercentB) - finite(baseline.bollingerPercentB)),
    bollingerBandwidth: Math.abs(finite(candidate.bollingerBandwidth) - finite(baseline.bollingerBandwidth)),
    volumeZScore: absoluteScaled(candidate.volumeZScore, baseline.volumeZScore, 10),
  };
};

export const assessIndicatorWarmupStability = (
  candles: Candle[],
  options: WarmupStabilityOptions = {},
): WarmupStabilityResult => {
  const source = (candles ?? []).slice();
  const requested = [...new Set((options.windows ?? [200, 250, 300, 400]).map((value) => Math.trunc(value)))]
    .filter((value) => value >= 200 && value <= source.length)
    .sort((a, b) => a - b);
  const watchThreshold = Math.max(0, options.watchThreshold ?? 0.005);
  const rejectThreshold = Math.max(watchThreshold, options.rejectThreshold ?? 0.02);

  if (requested.length < 2) {
    return {
      disposition: 'INSUFFICIENT_DATA', baselineCandles: requested[0] ?? null, comparedWindows: [], maxNormalizedDrift: null,
      reasons: ['Recursive warm-up analysis requires at least two eligible trailing windows of 200 or more candles.'],
      provenance: { method: 'SAME_TERMINAL_CANDLE_VARYING_WARMUP', minimumIndicatorCandles: 200, terminalTimestampHeldConstant: true, futureDataUsed: false },
    };
  }

  const terminalTimestamp = source[source.length - 1]?.timestamp;
  const baselineCandles = requested[requested.length - 1];
  const baselineSlice = source.slice(-baselineCandles);
  const baseline = buildIndicatorSnapshot(baselineSlice);
  const comparedWindows: WarmupStabilityWindow[] = [];

  for (const window of requested.slice(0, -1)) {
    const candidateSlice = source.slice(-window);
    if (candidateSlice[candidateSlice.length - 1]?.timestamp !== terminalTimestamp) {
      throw new Error('Warm-up stability comparison must hold the terminal candle constant.');
    }
    const candidate = buildIndicatorSnapshot(candidateSlice);
    const indicatorDrift = driftMap(candidate, baseline);
    comparedWindows.push({
      candles: window,
      maxNormalizedDrift: Math.max(...Object.values(indicatorDrift)),
      indicatorDrift,
    });
  }

  const maxNormalizedDrift = Math.max(...comparedWindows.map((item) => item.maxNormalizedDrift));
  const disposition: WarmupStabilityDisposition = maxNormalizedDrift > rejectThreshold
    ? 'REJECT'
    : maxNormalizedDrift > watchThreshold
      ? 'WATCH'
      : 'PASS';

  return {
    disposition,
    baselineCandles,
    comparedWindows,
    maxNormalizedDrift,
    reasons: [
      `${comparedWindows.length} shorter warm-up window(s) were compared with the ${baselineCandles}-candle baseline at the same terminal timestamp.`,
      `Maximum normalized indicator drift was ${(maxNormalizedDrift * 100).toFixed(4)}%; WATCH>${(watchThreshold * 100).toFixed(2)}%, REJECT>${(rejectThreshold * 100).toFixed(2)}%.`,
    ],
    provenance: { method: 'SAME_TERMINAL_CANDLE_VARYING_WARMUP', minimumIndicatorCandles: 200, terminalTimestampHeldConstant: true, futureDataUsed: false },
  };
};
