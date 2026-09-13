import type { TradingHorizon } from './horizonPolicy';

export interface HorizonPriceScenario {
  horizon: TradingHorizon;
  asOf: number;
  currentPrice: number;
  expectedPrice: number | null;
  expectedPriceLow: number | null;
  expectedPriceHigh: number | null;
  probabilityBullish: number | null;
  probabilityBearish: number | null;
  probabilityNeutral: number | null;
  evidenceIds: string[];
  modelIds: string[];
  assumptions: string[];
  dataGaps: string[];
}

export interface HorizonTradePlan {
  market: string;
  horizon: TradingHorizon;
  strategyId: string;
  direction: 'LONG' | 'NO_TRADE';
  entryPrice: number | null;
  structuralInvalidationPrice: number | null;
  stopLossPrice: number | null;
  takeProfit1Price: number | null;
  takeProfit2Price: number | null;
  finalTargetPrice: number | null;
  expectedHoldingPeriod: string;
  riskReward1: number | null;
  riskReward2: number | null;
  forecast: HorizonPriceScenario;
  reasons: string[];
  blockers: string[];
  executionAuthority: false;
}

const finitePositive = (value: number | null) => typeof value === 'number' && Number.isFinite(value) && value > 0;

export const validateHorizonTradePlan = (plan: HorizonTradePlan) => {
  const blockers = [...plan.blockers];
  if (plan.direction === 'LONG') {
    if (!finitePositive(plan.entryPrice)) blockers.push('Entry price is missing.');
    if (!finitePositive(plan.stopLossPrice)) blockers.push('Stop-loss price is missing.');
    if (!finitePositive(plan.takeProfit1Price)) blockers.push('TP1 is missing.');
    if (!finitePositive(plan.takeProfit2Price)) blockers.push('TP2 is missing.');
    if (!finitePositive(plan.structuralInvalidationPrice)) blockers.push('Structural invalidation price is missing.');
    if (plan.forecast.expectedPrice == null) blockers.push('Expected future price is unavailable.');
    if (plan.forecast.dataGaps.length) blockers.push(...plan.forecast.dataGaps.map((gap) => `Forecast DATA_GAP: ${gap}`));
  }
  const unique = Array.from(new Set(blockers));
  return { executableCandidate: plan.direction === 'LONG' && unique.length === 0, blockers: unique };
};

export const computeRiskReward = (entry: number, stop: number, target: number) => {
  if (![entry, stop, target].every((value) => Number.isFinite(value) && value > 0)) return null;
  const risk = entry - stop;
  const reward = target - entry;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
};
