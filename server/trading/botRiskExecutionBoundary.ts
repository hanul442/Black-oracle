export type BotExecutionMode = 'PAPER' | 'LIVE_SHADOW';
export type BotGovernanceOutcome = 'APPROVE' | 'NO_TRADE';
export type BotRiskOutcome = 'ALLOW_INTENT' | 'NO_TRADE';

export interface BotGovernanceRiskInput {
  contractVersion: 'bot.governance-decision.v1';
  decisionId: string;
  outcome: BotGovernanceOutcome;
  strategyId?: string;
  strategyRevision?: string;
  evidenceFingerprint: string;
  decidedAt: string;
  executionAuthority: false;
  capitalAuthority: false;
  riskBypassAuthority: false;
  liveAuthority: false;
}

export interface BotRiskSnapshot {
  snapshotId: string;
  strategyId: string;
  strategyRevision: string;
  observedAt: string;
  maxAgeMs: number;
  killSwitchEngaged: boolean;
  duplicateIntent: boolean;
  marketDataFresh: boolean;
  limitsSatisfied: boolean;
}

export interface BotRiskExecutionInput {
  contractVersion: 'bot.risk-execution-boundary.v1';
  now: string;
  mode: BotExecutionMode;
  governance: BotGovernanceRiskInput;
  risk?: BotRiskSnapshot;
}

export interface BotRiskExecutionDecision {
  contractVersion: 'bot.risk-execution-boundary.v1';
  decisionId: string;
  outcome: BotRiskOutcome;
  mode: BotExecutionMode;
  reasonCodes: string[];
  governanceDecisionId: string;
  governanceEvidenceFingerprint: string;
  strategyId?: string;
  strategyRevision?: string;
  riskSnapshotId?: string;
  evaluatedAt: string;
  orderIntentAuthority: false;
  brokerSubmissionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
  riskBypassAuthority: false;
  liveAuthority: false;
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseTime = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid timestamp: ${value}`);
  return parsed;
};

const assertNoAuthorityEscalation = (g: BotGovernanceRiskInput): void => {
  if (
    g.executionAuthority !== false ||
    g.capitalAuthority !== false ||
    g.riskBypassAuthority !== false ||
    g.liveAuthority !== false
  ) {
    throw new Error('governance authority escalation rejected');
  }
};

export function evaluateBotRiskExecutionBoundary(
  input: BotRiskExecutionInput,
): BotRiskExecutionDecision {
  if (input.contractVersion !== 'bot.risk-execution-boundary.v1') {
    throw new Error('unsupported risk execution contract');
  }
  if (input.mode !== 'PAPER' && input.mode !== 'LIVE_SHADOW') {
    throw new Error('unrestricted LIVE mode is not permitted');
  }
  if (input.governance.contractVersion !== 'bot.governance-decision.v1') {
    throw new Error('unsupported governance contract');
  }
  if (!nonEmpty(input.governance.decisionId) || !nonEmpty(input.governance.evidenceFingerprint)) {
    throw new Error('missing governance lineage');
  }
  assertNoAuthorityEscalation(input.governance);

  const nowMs = parseTime(input.now);
  const governanceMs = parseTime(input.governance.decidedAt);
  if (governanceMs > nowMs) {
    return noTrade(input, ['GOVERNANCE_FUTURE_TIMESTAMP']);
  }

  if (input.governance.outcome !== 'APPROVE') {
    return noTrade(input, ['GOVERNANCE_NO_TRADE']);
  }
  if (!nonEmpty(input.governance.strategyId) || !nonEmpty(input.governance.strategyRevision)) {
    return noTrade(input, ['GOVERNANCE_STRATEGY_IDENTITY_MISSING']);
  }
  if (!input.risk) return noTrade(input, ['RISK_SNAPSHOT_MISSING']);

  const risk = input.risk;
  if (
    !nonEmpty(risk.snapshotId) ||
    !nonEmpty(risk.strategyId) ||
    !nonEmpty(risk.strategyRevision) ||
    !Number.isFinite(risk.maxAgeMs) ||
    risk.maxAgeMs < 0
  ) {
    throw new Error('malformed risk snapshot');
  }
  if (
    risk.strategyId !== input.governance.strategyId ||
    risk.strategyRevision !== input.governance.strategyRevision
  ) {
    return noTrade(input, ['RISK_STRATEGY_IDENTITY_MISMATCH'], risk.snapshotId);
  }

  const observedMs = parseTime(risk.observedAt);
  if (observedMs > nowMs) return noTrade(input, ['RISK_SNAPSHOT_FUTURE'], risk.snapshotId);
  if (nowMs - observedMs > risk.maxAgeMs) return noTrade(input, ['RISK_SNAPSHOT_STALE'], risk.snapshotId);
  if (!risk.marketDataFresh) return noTrade(input, ['MARKET_DATA_STALE'], risk.snapshotId);
  if (risk.killSwitchEngaged) return noTrade(input, ['KILL_SWITCH_ENGAGED'], risk.snapshotId);
  if (risk.duplicateIntent) return noTrade(input, ['DUPLICATE_INTENT'], risk.snapshotId);
  if (!risk.limitsSatisfied) return noTrade(input, ['RISK_LIMITS_NOT_SATISFIED'], risk.snapshotId);

  return {
    contractVersion: 'bot.risk-execution-boundary.v1',
    decisionId: `risk:${input.governance.decisionId}:${risk.snapshotId}`,
    outcome: 'ALLOW_INTENT',
    mode: input.mode,
    reasonCodes: ['DETERMINISTIC_RISK_PASS', `MODE_${input.mode}`],
    governanceDecisionId: input.governance.decisionId,
    governanceEvidenceFingerprint: input.governance.evidenceFingerprint,
    strategyId: input.governance.strategyId,
    strategyRevision: input.governance.strategyRevision,
    riskSnapshotId: risk.snapshotId,
    evaluatedAt: input.now,
    orderIntentAuthority: false,
    brokerSubmissionAuthority: false,
    executionAuthority: false,
    capitalAuthority: false,
    riskBypassAuthority: false,
    liveAuthority: false,
  };
}

function noTrade(
  input: BotRiskExecutionInput,
  reasonCodes: string[],
  riskSnapshotId?: string,
): BotRiskExecutionDecision {
  return {
    contractVersion: 'bot.risk-execution-boundary.v1',
    decisionId: `risk:${input.governance.decisionId}:${riskSnapshotId ?? 'none'}`,
    outcome: 'NO_TRADE',
    mode: input.mode,
    reasonCodes,
    governanceDecisionId: input.governance.decisionId,
    governanceEvidenceFingerprint: input.governance.evidenceFingerprint,
    strategyId: input.governance.strategyId,
    strategyRevision: input.governance.strategyRevision,
    riskSnapshotId,
    evaluatedAt: input.now,
    orderIntentAuthority: false,
    brokerSubmissionAuthority: false,
    executionAuthority: false,
    capitalAuthority: false,
    riskBypassAuthority: false,
    liveAuthority: false,
  };
}
