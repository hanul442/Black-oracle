import type { EvidenceForecast } from './evidenceForecast';
import type { MultiTimeframeSnapshot, SignalAction } from './types';

export type StrategyRoute = 'TREND_MOMENTUM' | 'MEAN_REVERSION' | 'BLENDED' | 'NO_TRADE';
export type ForecastAlignment = 'ALIGNED' | 'CONFLICT' | 'NEUTRAL' | 'UNAVAILABLE';

export interface StrategyRouterDecision {
  route: StrategyRoute;
  confidence: number;
  forecastAlignment: ForecastAlignment;
  reasons: string[];
}

const actionMatches = (signal: SignalAction, target: SignalAction) => signal !== 'WAIT' && signal === target;

const classifyForecastAlignment = (
  action: MultiTimeframeSnapshot['action'],
  forecast: EvidenceForecast,
): ForecastAlignment => {
  if (!forecast.available || forecast.direction === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (forecast.direction === 'NEUTRAL' || action === 'WAIT') return 'NEUTRAL';
  if (forecast.direction === 'BULLISH' && action === 'BUY') return 'ALIGNED';
  if (forecast.direction === 'BEARISH' && action === 'SELL') return 'ALIGNED';
  return 'CONFLICT';
};

export const buildStrategyRouterDecision = (
  multiTimeframe: MultiTimeframeSnapshot,
  forecast: EvidenceForecast,
): StrategyRouterDecision => {
  const oneHour = multiTimeframe.frames.oneHour;
  const alignment = classifyForecastAlignment(multiTimeframe.action, forecast);
  const reasons: string[] = [];

  if (multiTimeframe.action === 'WAIT') {
    return {
      route: 'NO_TRADE',
      confidence: multiTimeframe.confidence,
      forecastAlignment: alignment,
      reasons: ['Multi-timeframe consensus is WAIT, matching the existing no-entry execution gate.'],
    };
  }

  if (multiTimeframe.confidence < 0.62) {
    return {
      route: 'NO_TRADE',
      confidence: multiTimeframe.confidence,
      forecastAlignment: alignment,
      reasons: ['Multi-timeframe confidence is below the existing 62% entry threshold.'],
    };
  }

  if (oneHour.regime.regime === 'RANGE') {
    if (
      actionMatches(oneHour.meanReversion.action, multiTimeframe.action)
      && oneHour.meanReversion.confidence >= 0.55
    ) {
      reasons.push('Range regime and mean-reversion signal align with the multi-timeframe direction.');
      if (alignment === 'CONFLICT') reasons.push('Evidence forecast conflicts with the technical route but does not bypass execution or risk gates.');
      return {
        route: 'MEAN_REVERSION',
        confidence: Math.min(multiTimeframe.confidence, oneHour.meanReversion.confidence),
        forecastAlignment: alignment,
        reasons,
      };
    }

    reasons.push('Range regime lacks a sufficiently aligned mean-reversion trigger, so the current fused signal remains blended.');
    if (alignment === 'CONFLICT') reasons.push('Evidence forecast conflicts with the technical route but is recorded as uncertainty only.');
    return {
      route: 'BLENDED',
      confidence: multiTimeframe.confidence,
      forecastAlignment: alignment,
      reasons,
    };
  }

  const trendMatches = actionMatches(oneHour.trend.action, multiTimeframe.action);
  const momentumMatches = actionMatches(oneHour.momentum.action, multiTimeframe.action);
  if (trendMatches || momentumMatches) {
    reasons.push(`Regime ${oneHour.regime.regime} favors trend/momentum routing and at least one engine aligns with consensus.`);
    if (alignment === 'CONFLICT') reasons.push('Evidence forecast conflict is preserved for audit and future routing calibration.');
    return {
      route: 'TREND_MOMENTUM',
      confidence: multiTimeframe.confidence,
      forecastAlignment: alignment,
      reasons,
    };
  }

  reasons.push('Consensus is actionable but no single regime-preferred engine dominates, so the fused route remains blended.');
  if (alignment === 'CONFLICT') reasons.push('Evidence forecast conflict is preserved without changing order authority.');
  return {
    route: 'BLENDED',
    confidence: multiTimeframe.confidence,
    forecastAlignment: alignment,
    reasons,
  };
};