import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlindValidationSample } from '../../src/trading/blindValidation';
import type { ExperimentLedgerEvent } from '../../src/trading/experimentLedger';
import type { GradeSurveillanceCheckpoint } from '../../src/trading/gradeSurveillance';
import type { ClosedPaperTrade } from '../../src/trading/performance';
import type { OracleRatingResult } from '../../src/trading/rating';
import type { TradingLedgerEvent } from '../../src/trading/types';
import type { InputValidationLedgerRecord } from '../../src/trading/validationDataset';
import { assembleStrategyPromotionEvidence, type PromotionEvidenceCheckpointLike } from './promotionEvidenceAssembler';

const START = Date.parse('2026-08-01T00:00:00.000Z');
const HOUR = 60 * 60_000;

const inputValidation = (timeframeMinutes: 15 | 60 | 240): InputValidationLedgerRecord => ({
  id: `input-${timeframeMinutes}`,
  createdAt: START,
  evaluationCutoff: START,
  policyVersion: 'S7_MULTI_TIMEFRAME_INPUT_VALIDATION_V1',
  dataset: {
    datasetId: `dataset-${timeframeMinutes}`,
    checksum: `sha256:${String(timeframeMinutes % 10).repeat(64)}`,
    checksumAlgorithm: 'SHA-256',
    canonicalization: 'BLACK_ORACLE_CANDLE_DATASET_V1',
    candleCount: 400,
    market: 'KRW-BTC',
    timeframeMinutes,
    firstTimestamp: START - 400 * timeframeMinutes * 60_000,
    lastTimestamp: START - timeframeMinutes * 60_000,
  },
  integrity: {
    disposition: 'PASS', sampleCount: 400,
    firstTimestamp: START - 400 * timeframeMinutes * 60_000,
    lastTimestamp: START - timeframeMinutes * 60_000,
    market: 'KRW-BTC', timeframeMinutes, issues: [],
    provenance: { evaluationCutoffEnforced: true, futureCandlesBlocked: true, chronologyCheckedOnSuppliedOrder: true, duplicateTimestampsBlocked: true, ohlcChecked: true, warmupChecked: true },
  },
  warmup: {
    disposition: 'PASS', baselineCandles: 400, comparedWindows: [{ candles: 200, maxNormalizedDrift: 0, indicatorDrift: {} }], maxNormalizedDrift: 0, reasons: [],
    provenance: { method: 'SAME_TERMINAL_CANDLE_VARYING_WARMUP', minimumIndicatorCandles: 200, terminalTimestampHeldConstant: true, futureDataUsed: false },
  },
  disposition: 'PASS', reasons: [], executionAuthority: false,
});

const validationSamples = (): BlindValidationSample[] => Array.from({ length: 60 }, (_, index) => {
  const decisionTimestamp = START + index * 8 * HOUR;
  return {
    market: 'KRW-BTC', decisionTimestamp, anchorTimestamp: decisionTimestamp + HOUR,
    targetTimestamp: decisionTimestamp + 5 * HOUR, action: 'ENTER', regime: 'UPTREND',
    anchorPrice: 100, targetPrice: 101, rawReturn: 0.01, directionalReturn: 0.01, favorable: true,
  };
});

const closedTrades = (): ClosedPaperTrade[] => Array.from({ length: 25 }, (_, index) => ({
  id: `trade-${index}`, market: 'KRW-BTC', openedAt: START + index * 12 * HOUR, closedAt: START + index * 12 * HOUR + 4 * HOUR,
  entryPrice: 100, exitPrice: 101, quantity: 1, grossPnl: 1, fees: 0.1, netPnl: 0.9, returnPct: 0.01,
  exitReason: 'test', strategyVersion: 'BO-TEST', entryOracleTradeScore: 75, exitOracleTradeScore: 70,
}));

const rating = (): OracleRatingResult => ({
  version: 'BO-RATING-v0.2-governance', grade: 'A0', baseGrade: 'A0', rawScore: 85, coverage: 1, confidenceScore: 0.9,
  confidence: 'HIGH', trend: 'STABLE', deploymentStatus: 'CHALLENGER', maxAllowedGrade: null,
  appliedGateKeys: [], missingRequiredDimensions: [], dimensions: [], reasons: [], executionAuthority: false,
});

const gradeCheckpoint = (): GradeSurveillanceCheckpoint => ({
  schemaVersion: 1,
  history: [{ timestamp: START + 25 * 12 * HOUR, scope: 'PAPER_READINESS', rating: rating(), sourceCheckpointSavedAt: START, executionAuthority: false }],
});

const ledger = (): TradingLedgerEvent[] => {
  const events: TradingLedgerEvent[] = [];
  for (let index = 0; index < 25; index += 1) {
    events.push({
      id: `signal-${index}`, sequence: events.length + 1, timestamp: START + index * HOUR, type: 'SIGNAL', strategyVersion: 'BO-TEST',
      payload: { independentPolicyParity: { status: 'PASS' }, targetPipelineParity: { status: 'PASS' } },
    });
  }
  for (let index = 0; index < 8; index += 1) {
    events.push({
      id: `fill-${index}`, sequence: events.length + 1, timestamp: START + 30 * HOUR + index * HOUR, type: 'ORDER_FILLED', strategyVersion: 'BO-TEST',
      payload: { executionAdapterParity: { status: 'PASS' } },
    });
  }
  return events;
};

const experimentLedger = (ids = ['rcfg-v1-0123456789abcdef']): ExperimentLedgerEvent[] => ids.map((id, index) => ({
  id: `exp-event-${index}`, sequence: index + 1, timestamp: START + index, type: 'EXPERIMENT_STARTED', experimentId: `exp-${index}`,
  payload: { researchConfigurationId: id },
}));

const checkpoint = (configIds?: string[]): PromotionEvidenceCheckpointLike => ({
  savedAt: START + 30 * 24 * HOUR,
  session: { ledger: ledger(), closedTrades: closedTrades() },
  loop: {
    validationSamples: validationSamples(),
    cycleHistory: Array.from({ length: 20 }, (_, index) => ({ markets: [{ evidenceIds: [`evidence-${index}`] }] })),
  },
  gradeSurveillance: gradeCheckpoint(),
  experimentLedger: experimentLedger(configIds),
});

test('assembles persisted evidence into a PASS hard-gate result when all explicit gates are satisfied', () => {
  const result = assembleStrategyPromotionEvidence(checkpoint(), {
    stage: 'INCUBATOR_TO_CHALLENGER',
    inputValidation: [inputValidation(15), inputValidation(60), inputValidation(240)],
    costStressVerdict: 'PASS',
  });

  assert.equal(result.evidence.blindValidation.verdict, 'PASS');
  assert.equal(result.evidence.walkForward.verdict, 'PASS');
  assert.equal(result.evidence.monteCarlo.verdict, 'PASS');
  assert.equal(result.evidence.auditCoverage, 1);
  assert.equal(result.evidence.researchConfigurationId, 'rcfg-v1-0123456789abcdef');
  assert.equal(result.evidence.researchConfigurationSource, 'UNIQUE_EXPERIMENT_LINEAGE');
  assert.equal(result.evidence.parity.adapterObserved, 8);
  assert.equal(result.eligibility.verdict, 'PASS');
  assert.equal(result.eligibility.eligible, true);
  assert.equal(result.promotionAuthority, false);
  assert.equal(result.executionAuthority, false);
  assert.equal(result.liveDeploymentAuthority, false);
});

test('ambiguous experiment lineage is not guessed and blocks promotion as insufficient evidence', () => {
  const result = assembleStrategyPromotionEvidence(checkpoint(['rcfg-v1-0123456789abcdef', 'rcfg-v1-fedcba9876543210']), {
    stage: 'INCUBATOR_TO_CHALLENGER',
    inputValidation: [inputValidation(15), inputValidation(60), inputValidation(240)],
    costStressVerdict: 'PASS',
  });

  assert.equal(result.evidence.researchConfigurationId, null);
  assert.equal(result.evidence.researchConfigurationSource, 'MISSING_OR_AMBIGUOUS');
  assert.equal(result.eligibility.verdict, 'INSUFFICIENT_DATA');
  assert.ok(result.eligibility.insufficientEvidence.includes('REPRODUCIBLE_LINEAGE'));
});

test('missing cost-stress evidence remains insufficient even when all other evidence is healthy', () => {
  const result = assembleStrategyPromotionEvidence(checkpoint(), {
    stage: 'INCUBATOR_TO_CHALLENGER',
    inputValidation: [inputValidation(15), inputValidation(60), inputValidation(240)],
  });
  assert.equal(result.eligibility.verdict, 'INSUFFICIENT_DATA');
  assert.ok(result.eligibility.insufficientEvidence.includes('COST_STRESS'));
});
