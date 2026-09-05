export type AuditDimensionId =
  | 'MARKET_CONTEXT'
  | 'TECHNICAL_TRACE'
  | 'RISK_GATE'
  | 'EVIDENCE'
  | 'FORECAST_SCENARIO'
  | 'COUNCIL'
  | 'EXECUTION_TRACE'
  | 'OUTCOME';

export type AuditDimensionState = 'PASS' | 'MISSING' | 'NOT_APPLICABLE';

export interface AuditDimensionResult {
  id: AuditDimensionId;
  state: AuditDimensionState;
  reason: string;
}

export interface AuditCompletenessAssessment {
  score: number;
  grade: 'COMPLETE' | 'STRONG' | 'PARTIAL' | 'WEAK';
  passed: number;
  applicable: number;
  missing: AuditDimensionId[];
  dimensions: AuditDimensionResult[];
}

export interface AuditCompletenessInput {
  action: string;
  timestamp?: number | null;
  market?: string | null;
  regime?: string | null;
  oracleTradeScore?: number | null;
  confidence?: number | null;
  strategyDisposition?: string | null;
  riskDisposition?: string | null;
  evidenceActiveCount?: number | null;
  evidenceIds?: string[] | null;
  forecastAvailable?: boolean | null;
  scenarioLinked?: boolean | null;
  councilLinked?: boolean | null;
  executionLinked?: boolean | null;
  outcomeLinked?: boolean | null;
  primaryReason?: string | null;
  reasons?: string[] | null;
}

const result = (id: AuditDimensionId, state: AuditDimensionState, reason: string): AuditDimensionResult => ({ id, state, reason });

export const assessAuditCompleteness = (input: AuditCompletenessInput): AuditCompletenessAssessment => {
  const action = String(input.action || '').toUpperCase();
  const executionRequired = action === 'ENTER' || action === 'EXIT';
  const outcomeRequired = action === 'EXIT';
  const evidenceIds = Array.isArray(input.evidenceIds) ? input.evidenceIds.filter(Boolean) : [];
  const reasons = Array.isArray(input.reasons) ? input.reasons.filter(Boolean) : [];

  const dimensions: AuditDimensionResult[] = [
    input.market && input.regime && Number.isFinite(input.oracleTradeScore) && Number.isFinite(input.confidence)
      ? result('MARKET_CONTEXT', 'PASS', 'Market, regime, score and confidence were persisted.')
      : result('MARKET_CONTEXT', 'MISSING', 'Persist market, regime, score and confidence together.'),
    input.strategyDisposition && (Boolean(input.primaryReason) || reasons.length > 0)
      ? result('TECHNICAL_TRACE', 'PASS', 'Strategy route and explicit technical reasoning were persisted.')
      : result('TECHNICAL_TRACE', 'MISSING', 'Strategy route or explicit technical reasoning is missing.'),
    input.riskDisposition && input.riskDisposition !== 'NOT_EVALUATED'
      ? result('RISK_GATE', 'PASS', `Risk gate persisted as ${input.riskDisposition}.`)
      : result('RISK_GATE', 'MISSING', 'A deterministic risk-gate result was not persisted.'),
    (input.evidenceActiveCount || 0) > 0 && evidenceIds.length > 0
      ? result('EVIDENCE', 'PASS', `${input.evidenceActiveCount} active evidence item(s) linked.`)
      : result('EVIDENCE', 'MISSING', 'No active structured evidence provenance is attached.'),
    input.forecastAvailable && input.scenarioLinked
      ? result('FORECAST_SCENARIO', 'PASS', 'Evidence-backed forecast and scenario linkage are present.')
      : result('FORECAST_SCENARIO', 'MISSING', input.forecastAvailable ? 'Forecast exists but persisted scenario linkage is missing.' : 'Evidence-backed forecast/scenario output is unavailable.'),
    input.councilLinked
      ? result('COUNCIL', 'PASS', 'A persisted Council run is linked.')
      : result('COUNCIL', 'MISSING', 'No persisted Council run is linked.'),
    executionRequired
      ? input.executionLinked
        ? result('EXECUTION_TRACE', 'PASS', 'Execution/fill trace is linked to the decision.')
        : result('EXECUTION_TRACE', 'MISSING', 'ENTER/EXIT requires a linked execution or fill trace.')
      : result('EXECUTION_TRACE', 'NOT_APPLICABLE', 'No execution is expected for HOLD/NO_TRADE.'),
    outcomeRequired
      ? input.outcomeLinked
        ? result('OUTCOME', 'PASS', 'Exit/outcome linkage is available for post-mortem.')
        : result('OUTCOME', 'MISSING', 'EXIT requires a persisted outcome linkage for post-mortem.')
      : result('OUTCOME', 'NOT_APPLICABLE', 'Outcome is not yet applicable to this decision.'),
  ];

  const applicable = dimensions.filter((item) => item.state !== 'NOT_APPLICABLE');
  const passed = applicable.filter((item) => item.state === 'PASS').length;
  const score = applicable.length ? Math.round((passed / applicable.length) * 100) : 0;
  const grade: AuditCompletenessAssessment['grade'] = score === 100
    ? 'COMPLETE'
    : score >= 80
      ? 'STRONG'
      : score >= 50
        ? 'PARTIAL'
        : 'WEAK';

  return {
    score,
    grade,
    passed,
    applicable: applicable.length,
    missing: applicable.filter((item) => item.state === 'MISSING').map((item) => item.id),
    dimensions,
  };
};
