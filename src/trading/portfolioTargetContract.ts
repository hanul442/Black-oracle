import type { ExecutionDecision, PaperPortfolioSnapshot } from './types';

export type PortfolioTargetIntent = 'INCREASE_LONG' | 'FLAT' | 'MAINTAIN';

/**
 * Standardized target-state bridge between strategy/risk decisions and execution.
 *
 * V1 is intentionally SHADOW_ONLY: the existing deterministic Paper execution path
 * remains authoritative. This contract makes the desired portfolio state explicit so
 * Replay/Paper/future human-approved Live adapters can converge on one interface
 * without granting this object order authority.
 */
export interface PortfolioTargetContract {
  schemaVersion: 1;
  id: string;
  source: 'LEGACY_EXECUTION_DECISION_SHADOW_V1';
  executionAuthority: false;
  strategyVersion: string;
  market: string;
  generatedAt: number;
  referencePrice: number;
  intent: PortfolioTargetIntent;
  currentWeight: number;
  targetWeight: number;
  currentNotional: number;
  targetNotional: number;
  deltaNotional: number;
  confidence: number;
  sourceAction: ExecutionDecision['action'];
  sideHint: 'BUY' | 'SELL' | null;
  riskDisposition: ExecutionDecision['riskDisposition'];
  reasons: string[];
}

export interface PortfolioTargetContractInput {
  market: string;
  strategyVersion: string;
  generatedAt: number;
  referencePrice: number;
  portfolio: PaperPortfolioSnapshot;
  decision: ExecutionDecision;
}

const finiteNonNegative = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative.`);
  return value;
};

const normalizedWeight = (notional: number, equity: number) => equity > 0 ? notional / equity : 0;

const fnv1a32 = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const stableTargetId = (value: string) => `${fnv1a32(`A|${value}`)}${fnv1a32(`B|${value}`)}`;

export const projectExecutionDecisionToPortfolioTarget = (
  input: PortfolioTargetContractInput,
): PortfolioTargetContract => {
  const market = String(input.market ?? '').toUpperCase();
  if (!/^KRW-[A-Z0-9]+$/.test(market)) throw new Error(`Invalid target-contract market: ${market}`);
  if (!input.strategyVersion) throw new Error('Portfolio target contract requires a strategyVersion.');
  if (!Number.isFinite(input.generatedAt) || input.generatedAt <= 0) throw new Error('Portfolio target generatedAt must be positive and finite.');
  if (!Number.isFinite(input.referencePrice) || input.referencePrice <= 0) throw new Error('Portfolio target referencePrice must be positive and finite.');
  if (!Number.isFinite(input.portfolio.equity) || input.portfolio.equity <= 0) throw new Error('Portfolio target requires positive portfolio equity.');

  const position = input.portfolio.positions.find((candidate) => candidate.market === market);
  const currentNotional = finiteNonNegative(
    position ? position.quantity * input.referencePrice : 0,
    'Portfolio target currentNotional',
  );

  let targetNotional = currentNotional;
  if (input.decision.action === 'ENTER') {
    targetNotional = currentNotional + finiteNonNegative(input.decision.notional, 'Execution decision notional');
  } else if (input.decision.action === 'EXIT') {
    targetNotional = 0;
  }
  targetNotional = finiteNonNegative(targetNotional, 'Portfolio target targetNotional');

  const deltaNotional = targetNotional - currentNotional;
  const epsilon = Math.max(1e-9, input.portfolio.equity * 1e-12);
  const intent: PortfolioTargetIntent = deltaNotional > epsilon
    ? 'INCREASE_LONG'
    : deltaNotional < -epsilon
      ? 'FLAT'
      : 'MAINTAIN';

  if (input.decision.action === 'ENTER' && input.decision.side !== 'BUY') {
    throw new Error('Spot target contract only supports BUY for ENTER in v1.');
  }
  if (input.decision.action === 'EXIT' && input.decision.side !== 'SELL') {
    throw new Error('Spot target contract only supports SELL for EXIT in v1.');
  }

  const rawId = `${input.strategyVersion}:${market}:${input.generatedAt}:${input.decision.action}:${Math.round(targetNotional * 1_000_000)}`;
  return {
    schemaVersion: 1,
    id: `ptgt-v1-${stableTargetId(rawId)}`,
    source: 'LEGACY_EXECUTION_DECISION_SHADOW_V1',
    executionAuthority: false,
    strategyVersion: input.strategyVersion,
    market,
    generatedAt: input.generatedAt,
    referencePrice: input.referencePrice,
    intent,
    currentWeight: normalizedWeight(currentNotional, input.portfolio.equity),
    targetWeight: normalizedWeight(targetNotional, input.portfolio.equity),
    currentNotional,
    targetNotional,
    deltaNotional,
    confidence: Math.max(0, Math.min(1, Number.isFinite(input.decision.confidence) ? input.decision.confidence : 0)),
    sourceAction: input.decision.action,
    sideHint: deltaNotional > epsilon ? 'BUY' : deltaNotional < -epsilon ? 'SELL' : null,
    riskDisposition: input.decision.riskDisposition,
    reasons: input.decision.reasons.slice(),
  };
};
