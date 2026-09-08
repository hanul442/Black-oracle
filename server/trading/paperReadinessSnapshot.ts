import { assessAuditCompleteness } from '../../src/trading/auditCompleteness.ts';
import { runWalkForwardValidation } from '../../src/trading/blindValidation.ts';
import { summarizeIntegrityLedger } from '../../src/trading/integrityLedger.ts';
import { buildPaperReadinessRating, type PaperReadinessRatingInput } from '../../src/trading/paperReadinessRating.ts';
import { buildRiskProfileComparison } from '../../src/trading/riskProfiles.ts';
import { summarizeValidationSamples } from '../../src/trading/validationLedger.ts';
import type { OracleRatingSnapshot } from '../../src/trading/gradeSurveillance.ts';
import type { TradingRuntimeCheckpoint } from './persistence.ts';

export interface PaperReadinessSnapshotBundle {
  snapshot: OracleRatingSnapshot;
  input: PaperReadinessRatingInput;
  evidenceCoverage: number;
  auditAverage: number;
  weakExecutions: number;
  runtimeHealthy: boolean;
}

const auditExecutionCoverage = (checkpoint: TradingRuntimeCheckpoint) => {
  const portfolio = checkpoint.session.portfolio;
  const tradeCases = Array.isArray(checkpoint.tradeCases) ? checkpoint.tradeCases : [];
  const actualEntryExecutions = checkpoint.session.closedTrades.length + portfolio.positions.length;
  const evidenceLinkedEntries = tradeCases.filter((item) => (
    item.entry?.decision?.evidenceActiveCount > 0
    && Array.isArray(item.entry?.decision?.evidenceIds)
    && item.entry.decision.evidenceIds.length > 0
  )).length;
  const evidenceCoverage = actualEntryExecutions > 0 ? evidenceLinkedEntries / actualEntryExecutions : 0;

  const auditScores: number[] = [];
  for (const item of tradeCases) {
    const entry = item.entry;
    auditScores.push(assessAuditCompleteness({
      action: entry.decision.action,
      timestamp: entry.timestamp,
      market: item.market,
      regime: entry.decision.regime,
      oracleTradeScore: entry.multiTimeframe.oracleTradeScore,
      confidence: entry.multiTimeframe.confidence,
      strategyDisposition: entry.decision.route,
      riskDisposition: entry.decision.riskDisposition,
      evidenceActiveCount: entry.decision.evidenceActiveCount,
      evidenceIds: entry.decision.evidenceIds,
      forecastAvailable: Boolean(entry.decision.forecast?.available),
      scenarioLinked: Boolean(item.scenarioSetId || item.governanceSnapshot?.scenarioSetId),
      councilLinked: Boolean(item.councilRunId || item.governanceSnapshot?.councilRunId),
      executionLinked: true,
      outcomeLinked: null,
      primaryReason: entry.decision.primaryReason,
      reasons: entry.decision.reasons,
    }).score);

    if (item.status === 'CLOSED' && item.latestDecision?.action === 'EXIT') {
      const trace = item.latestDecision;
      auditScores.push(assessAuditCompleteness({
        action: trace.action,
        timestamp: trace.timestamp,
        market: trace.market,
        regime: trace.regime,
        oracleTradeScore: trace.oracleTradeScore,
        confidence: trace.confidence,
        strategyDisposition: trace.strategyDisposition,
        riskDisposition: trace.riskDisposition,
        evidenceActiveCount: trace.evidenceActiveCount,
        evidenceIds: trace.evidenceIds,
        forecastAvailable: Boolean(trace.forecast?.available),
        scenarioLinked: Boolean(trace.governance?.scenarioSetId || item.scenarioSetId || item.governanceSnapshot?.scenarioSetId),
        councilLinked: Boolean(trace.governance?.councilRunId || item.councilRunId || item.governanceSnapshot?.councilRunId),
        executionLinked: Boolean(item.closedAt),
        outcomeLinked: Boolean(item.closedAt),
        primaryReason: trace.primaryReason,
        reasons: trace.reasons,
      }).score);
    }
  }

  const actualExecutionEvents = actualEntryExecutions + checkpoint.session.closedTrades.length;
  const legacyUnlinkedExecutionEvents = Math.max(0, actualExecutionEvents - auditScores.length);
  const auditAverage = actualExecutionEvents > 0
    ? auditScores.reduce((sum, score) => sum + score, 0) / (actualExecutionEvents * 100)
    : 0;
  const weakExecutions = auditScores.filter((score) => score < 50).length + legacyUnlinkedExecutionEvents;
  return { evidenceCoverage, auditAverage, weakExecutions };
};

export const buildPaperReadinessSnapshotFromCheckpoint = (
  checkpoint: TradingRuntimeCheckpoint,
  now = Date.now(),
): PaperReadinessSnapshotBundle => {
  const validationSamples = Array.isArray(checkpoint.loop.validationSamples) ? checkpoint.loop.validationSamples : [];
  const historical = summarizeValidationSamples(validationSamples, { minSamples: 60, minObservationDays: 14 });
  const walkForward = runWalkForwardValidation(validationSamples, { folds: 4, minimumTestSamples: 10 });
  const returns = checkpoint.session.closedTrades.map((trade) => trade.returnPct);
  const monteCarlo = buildRiskProfileComparison(returns)[0]?.validation;
  const integrity = summarizeIntegrityLedger((checkpoint as any).integrity ?? null, now, 14);
  const audit = auditExecutionCoverage(checkpoint);

  const lastCycle = checkpoint.loop.lastCycle;
  const cycleAgeMs = lastCycle ? Math.max(0, now - lastCycle.finishedAt) : Number.POSITIVE_INFINITY;
  const staleThresholdMs = checkpoint.loop.config.intervalMs * 2.5;
  const runtimeHealthy = Boolean(lastCycle && cycleAgeMs <= staleThresholdMs && (lastCycle.errors?.length ?? 0) === 0);

  const input: PaperReadinessRatingInput = {
    evidenceCoverage: audit.evidenceCoverage,
    auditAverage: audit.auditAverage,
    historicalVerdict: historical.verdict,
    walkForwardVerdict: walkForward.verdict,
    monteCarloVerdict: monteCarlo?.verdict ?? 'INSUFFICIENT_DATA',
    integrityCoverageDays: integrity.coverageDays,
    integrityRequiredDays: integrity.requiredCoverageDays,
    integrityCoverageComplete: integrity.coverageComplete,
    fatalRuntimeIncidents: integrity.fatalRuntimeIncidents,
    unresolvedCriticalIncidents: integrity.unresolvedCriticalIncidents,
    runtimeHealthy,
    closedTrades: checkpoint.session.closedTrades.length,
    requiredClosedTrades: 60,
    observationDays: historical.observationDays,
    requiredObservationDays: 14,
  };
  const rating = buildPaperReadinessRating(input);

  return {
    snapshot: {
      timestamp: now,
      scope: 'PAPER_READINESS',
      rating,
      sourceCheckpointSavedAt: checkpoint.savedAt ?? null,
      executionAuthority: false,
    },
    input,
    evidenceCoverage: audit.evidenceCoverage,
    auditAverage: audit.auditAverage,
    weakExecutions: audit.weakExecutions,
    runtimeHealthy,
  };
};
