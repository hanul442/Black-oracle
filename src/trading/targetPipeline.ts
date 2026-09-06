import { projectExecutionDecisionToPortfolioTarget, type PortfolioTargetContract, type PortfolioTargetContractInput } from './portfolioTargetContract';
import type { ExecutionDecision } from './types';

export type StrategyIntentAction = 'OPEN_LONG' | 'CLOSE_LONG' | 'MAINTAIN';
export type TargetParityStatus = 'PASS' | 'REJECT';

/**
 * Sprint 7 transition contract. This is deliberately derived from the currently
 * authoritative legacy decision so the new architecture can prove semantic parity
 * before any execution authority is migrated.
 */
export interface StrategyIntentContract {
  schemaVersion: 1;
  id: string;
  source: 'LEGACY_EXECUTION_DECISION_SHADOW_V1';
  executionAuthority: false;
  market: string;
  strategyVersion: string;
  generatedAt: number;
  action: StrategyIntentAction;
  requestedNotional: number;
  confidence: number;
  sourceAction: ExecutionDecision['action'];
  reasons: string[];
}

export interface RiskAdjustedTargetContract {
  schemaVersion: 1;
  id: string;
  source: 'POST_LEGACY_RISK_SHADOW_V1';
  executionAuthority: false;
  strategyIntentId: string;
  portfolioTargetId: string;
  market: string;
  generatedAt: number;
  currentNotional: number;
  approvedTargetNotional: number;
  approvedDeltaNotional: number;
  currentWeight: number;
  approvedTargetWeight: number;
  sideHint: 'BUY' | 'SELL' | null;
  riskDisposition: ExecutionDecision['riskDisposition'];
  riskReasons: string[];
}

export interface TargetPipelineParityReport {
  schemaVersion: 1;
  id: string;
  executionAuthority: false;
  status: TargetParityStatus;
  sourceAction: ExecutionDecision['action'];
  legacySide: ExecutionDecision['side'];
  targetSide: 'BUY' | 'SELL' | null;
  expectedDeltaNotional: number;
  actualDeltaNotional: number;
  absoluteDifference: number;
  tolerance: number;
  reasons: string[];
}

export interface ShadowTargetPipelineTrace {
  schemaVersion: 1;
  executionAuthority: false;
  intent: StrategyIntentContract;
  target: PortfolioTargetContract;
  riskAdjustedTarget: RiskAdjustedTargetContract;
  parity: TargetPipelineParityReport;
}

const intentAction = (decision: ExecutionDecision): StrategyIntentAction => {
  if (decision.action === 'ENTER') return 'OPEN_LONG';
  if (decision.action === 'EXIT') return 'CLOSE_LONG';
  return 'MAINTAIN';
};

const stableSuffix = (targetId: string) => targetId.replace(/^ptgt-v1-/, '');

const expectedSignedDelta = (decision: ExecutionDecision, target: PortfolioTargetContract) => {
  if (decision.action === 'ENTER') return decision.notional;
  if (decision.action === 'EXIT') return -target.currentNotional;
  return 0;
};

const expectedSide = (delta: number): 'BUY' | 'SELL' | null => delta > 0 ? 'BUY' : delta < 0 ? 'SELL' : null;

export const buildShadowTargetPipeline = (
  input: PortfolioTargetContractInput,
): ShadowTargetPipelineTrace => {
  const target = projectExecutionDecisionToPortfolioTarget(input);
  const suffix = stableSuffix(target.id);
  const requestedNotional = input.decision.action === 'ENTER' || input.decision.action === 'EXIT'
    ? Math.max(0, Number.isFinite(input.decision.notional) ? input.decision.notional : 0)
    : 0;

  const intent: StrategyIntentContract = {
    schemaVersion: 1,
    id: `sint-v1-${suffix}`,
    source: 'LEGACY_EXECUTION_DECISION_SHADOW_V1',
    executionAuthority: false,
    market: target.market,
    strategyVersion: target.strategyVersion,
    generatedAt: target.generatedAt,
    action: intentAction(input.decision),
    requestedNotional,
    confidence: target.confidence,
    sourceAction: input.decision.action,
    reasons: input.decision.reasons.slice(),
  };

  // The current ExecutionDecision has already passed/rejected the legacy risk engine.
  // S7-03 therefore records the approved target state without re-running or changing risk.
  const riskAdjustedTarget: RiskAdjustedTargetContract = {
    schemaVersion: 1,
    id: `rtgt-v1-${suffix}`,
    source: 'POST_LEGACY_RISK_SHADOW_V1',
    executionAuthority: false,
    strategyIntentId: intent.id,
    portfolioTargetId: target.id,
    market: target.market,
    generatedAt: target.generatedAt,
    currentNotional: target.currentNotional,
    approvedTargetNotional: target.targetNotional,
    approvedDeltaNotional: target.deltaNotional,
    currentWeight: target.currentWeight,
    approvedTargetWeight: target.targetWeight,
    sideHint: target.sideHint,
    riskDisposition: input.decision.riskDisposition,
    riskReasons: input.decision.riskReasons.slice(),
  };

  const expectedDeltaNotional = expectedSignedDelta(input.decision, target);
  const actualDeltaNotional = riskAdjustedTarget.approvedDeltaNotional;
  const absoluteDifference = Math.abs(expectedDeltaNotional - actualDeltaNotional);
  const tolerance = Math.max(1e-6, input.portfolio.equity * 1e-9);
  const targetSide = riskAdjustedTarget.sideHint;
  const legacyExpectedSide = expectedSide(expectedDeltaNotional);
  const amountParity = absoluteDifference <= tolerance;
  const sideParity = targetSide === legacyExpectedSide && input.decision.side === legacyExpectedSide;
  const status: TargetParityStatus = amountParity && sideParity ? 'PASS' : 'REJECT';
  const reasons = [
    `Legacy expected delta=${expectedDeltaNotional}; shadow target delta=${actualDeltaNotional}; tolerance=${tolerance}.`,
    `Legacy side=${input.decision.side ?? 'NONE'}; shadow target side=${targetSide ?? 'NONE'}.`,
  ];
  if (!amountParity) reasons.push('Target notional delta diverged from the authoritative legacy decision.');
  if (!sideParity) reasons.push('Target side semantics diverged from the authoritative legacy decision.');

  const parity: TargetPipelineParityReport = {
    schemaVersion: 1,
    id: `tpar-v1-${suffix}`,
    executionAuthority: false,
    status,
    sourceAction: input.decision.action,
    legacySide: input.decision.side,
    targetSide,
    expectedDeltaNotional,
    actualDeltaNotional,
    absoluteDifference,
    tolerance,
    reasons,
  };

  return {
    schemaVersion: 1,
    executionAuthority: false,
    intent,
    target,
    riskAdjustedTarget,
    parity,
  };
};
