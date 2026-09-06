import { DEFAULT_RISK_LIMITS } from './config';

export type CostStressVerdict = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface CostStressPolicy {
  version: string;
  minTrades: number;
  additionalRoundTripCostBps: number[];
  passMaxDrawdownPct: number;
  watchMaxDrawdownPct: number;
  watchMeanReturnFloor: number;
  watchTerminalReturnFloor: number;
}

export interface CostStressScenario {
  additionalRoundTripCostBps: number;
  meanReturn: number;
  medianReturn: number;
  positiveRate: number;
  terminalReturn: number;
  maxDrawdownPct: number;
}

export interface CostStressValidation {
  schemaVersion: 1;
  policyVersion: string;
  verdict: CostStressVerdict;
  available: boolean;
  tradeCount: number;
  scenarios: CostStressScenario[];
  worstScenario: CostStressScenario | null;
  reasons: string[];
  promotionAuthority: false;
  executionAuthority: false;
}

export const DEFAULT_COST_STRESS_POLICY: CostStressPolicy = {
  version: 'S7_INCREMENTAL_COST_STRESS_V1',
  minTrades: 20,
  additionalRoundTripCostBps: [5, 10, 20, 30],
  passMaxDrawdownPct: DEFAULT_RISK_LIMITS.maxTotalDrawdownPct,
  watchMaxDrawdownPct: DEFAULT_RISK_LIMITS.maxTotalDrawdownPct * 1.5,
  watchMeanReturnFloor: -0.001,
  watchTerminalReturnFloor: -0.02,
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const ordered = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

const summarizeScenario = (returns: number[], additionalRoundTripCostBps: number): CostStressScenario => {
  const costDrag = additionalRoundTripCostBps / 10_000;
  const stressed = returns.map((value) => Math.max(-0.999, value - costDrag));
  const meanReturn = stressed.reduce((sum, value) => sum + value, 0) / stressed.length;
  const medianReturn = median(stressed);
  const positiveRate = stressed.filter((value) => value > 0).length / stressed.length;
  let equity = 1;
  let peak = 1;
  let maxDrawdownPct = 0;
  for (const value of stressed) {
    equity *= 1 + value;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, (peak - equity) / peak);
  }
  return {
    additionalRoundTripCostBps,
    meanReturn,
    medianReturn,
    positiveRate,
    terminalReturn: equity - 1,
    maxDrawdownPct,
  };
};

export const buildCostStressValidation = (
  tradeReturns: number[],
  policyOverrides: Partial<CostStressPolicy> = {},
): CostStressValidation => {
  const policy: CostStressPolicy = {
    ...DEFAULT_COST_STRESS_POLICY,
    ...policyOverrides,
    minTrades: Math.max(5, Math.min(500, Math.trunc(policyOverrides.minTrades ?? DEFAULT_COST_STRESS_POLICY.minTrades))),
    additionalRoundTripCostBps: [...new Set((policyOverrides.additionalRoundTripCostBps ?? DEFAULT_COST_STRESS_POLICY.additionalRoundTripCostBps)
      .map((value) => Math.max(0, Math.min(500, Number(value))))
      .filter(Number.isFinite))].sort((a, b) => a - b),
  };
  if (!policy.additionalRoundTripCostBps.length) throw new Error('Cost stress requires at least one additional cost scenario.');

  const returns = (tradeReturns ?? []).filter((value) => Number.isFinite(value) && value > -1 && value < 10);
  if (returns.length < policy.minTrades) {
    return {
      schemaVersion: 1,
      policyVersion: policy.version,
      verdict: 'INSUFFICIENT_DATA',
      available: false,
      tradeCount: returns.length,
      scenarios: [],
      worstScenario: null,
      reasons: [`At least ${policy.minTrades} closed PAPER trades are required for cost stress; ${returns.length} are available.`],
      promotionAuthority: false,
      executionAuthority: false,
    };
  }

  const scenarios = policy.additionalRoundTripCostBps.map((bps) => summarizeScenario(returns, bps));
  const worstScenario = scenarios[scenarios.length - 1];
  let verdict: CostStressVerdict = 'REJECT';
  const reasons: string[] = [];

  if (
    worstScenario.meanReturn > 0
    && worstScenario.terminalReturn > 0
    && worstScenario.maxDrawdownPct <= policy.passMaxDrawdownPct
  ) {
    verdict = 'PASS';
    reasons.push(`Strategy remains profitable with max drawdown within ${(policy.passMaxDrawdownPct * 100).toFixed(1)}% after an additional ${worstScenario.additionalRoundTripCostBps} bps round-trip cost shock.`);
  } else if (
    worstScenario.meanReturn >= policy.watchMeanReturnFloor
    && worstScenario.terminalReturn >= policy.watchTerminalReturnFloor
    && worstScenario.maxDrawdownPct <= policy.watchMaxDrawdownPct
  ) {
    verdict = 'WATCH';
    reasons.push(`Highest cost shock remains near break-even but does not satisfy the PASS resilience threshold.`);
  } else {
    reasons.push(`Additional ${worstScenario.additionalRoundTripCostBps} bps round-trip cost shock destroys required expectancy, terminal return, or drawdown resilience.`);
  }

  const firstNegativeMean = scenarios.find((scenario) => scenario.meanReturn <= 0);
  if (firstNegativeMean) reasons.push(`Mean expectancy becomes non-positive at ${firstNegativeMean.additionalRoundTripCostBps} additional bps.`);
  reasons.push('Stress costs are incremental to the already net PAPER trade returns; this module does not grant promotion or execution authority.');

  return {
    schemaVersion: 1,
    policyVersion: policy.version,
    verdict,
    available: true,
    tradeCount: returns.length,
    scenarios,
    worstScenario,
    reasons,
    promotionAuthority: false,
    executionAuthority: false,
  };
};
