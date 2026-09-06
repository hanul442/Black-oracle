import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlindValidationResult, WalkForwardResult } from './blindValidation';
import type { MonteCarloValidation } from './monteCarlo';
import { buildStrategyPromotionEligibility, summarizePromotionParityFromLedger } from './promotionHardGate';
import type { OracleRatingResult } from './rating';
import type { TradingLedgerEvent } from './types';
import type { InputValidationLedgerRecord } from './validationDataset';

const inputValidation = (): InputValidationLedgerRecord => ({
  id: 'input-validation:test', createdAt: 1_700_000_000_000, evaluationCutoff: 1_700_000_000_000,
  policyVersion: 'S7_INPUT_VALIDATION_V1',
  dataset: {
    datasetId: 'candle-set:0123456789abcdef01234567', checksum: `sha256:${'a'.repeat(64)}`, checksumAlgorithm: 'SHA-256',
    canonicalization: 'BLACK_ORACLE_CANDLE_DATASET_V1', candleCount: 400, market: 'KRW-BTC', timeframeMinutes: 15,
    firstTimestamp: 1_699_000_000_000, lastTimestamp: 1_700_000_000_000,
  },
  integrity: { disposition: 'PASS', issues: [], candleCount: 400, expectedIntervalMs: 900_000, maxObservedGapMs: 900_000 } as InputValidationLedgerRecord['integrity'],
  warmup: { disposition: 'PASS', baselineCandles: 400, comparisons: [], reasons: [] } as InputValidationLedgerRecord['warmup'],
  disposition: 'PASS', reasons: [], executionAuthority: false,
});

const blind = (): BlindValidationResult => ({
  verdict: 'PASS', sampleCount: 80, observationDays: 21, favorableRate: 0.6, meanDirectionalReturn: 0.01,
  medianDirectionalReturn: 0.008, byRegime: [], reasons: [],
  provenance: { noLookahead: true, anchorRule: 'FIRST_PERSISTED_PRICE_AT_OR_AFTER_DECISION', targetRule: 'FIRST_PERSISTED_PRICE_AT_OR_AFTER_ANCHOR_PLUS_HORIZON', horizonMs: 14_400_000, minSamples: 60, minObservationDays: 14 },
  samples: [],
});

const walkForward = (): WalkForwardResult => ({
  verdict: 'PASS', folds: [], positiveFoldRate: 0.75, reasons: [], provenance: { chronological: true, testDataAlwaysAfterTrainingData: true },
});

const monteCarlo = (): MonteCarloValidation => ({
  verdict: 'PASS', available: true, tradeCount: 40, scenarioCount: 1_000, seed: 1, horizonTrades: 40,
  survivalProbability: 0.98, ruinProbability: 0.02, profitableProbability: 0.7,
  terminalReturn: { p05: -0.02, median: 0.1, p95: 0.3 }, maxDrawdown: { p05: 0.01, median: 0.03, p95: 0.045, worst: 0.049 },
  thresholds: { drawdownLimitPct: 0.05, passSurvivalProbability: 0.95, watchSurvivalProbability: 0.8 },
  assumptions: { bootstrapWithReplacement: true, costInflationBps: 10, adverseShockPct: 0.001, winnerHaircut: 0.85, loserAmplification: 1.1 }, reasons: [],
});

const rating = (grade: OracleRatingResult['grade'] = 'A0'): OracleRatingResult => ({
  version: 'BO-RATING-v0.2-governance', grade, baseGrade: grade, rawScore: 85, coverage: 1, confidenceScore: 0.9,
  confidence: 'HIGH', trend: 'STABLE', deploymentStatus: grade.startsWith('AA') || grade.startsWith('AAA') ? 'CHAMPION_CANDIDATE' : 'CHALLENGER',
  maxAllowedGrade: null, appliedGateKeys: [], missingRequiredDimensions: [], dimensions: [], reasons: [], executionAuthority: false,
});

const passingInput = () => ({
  stage: 'INCUBATOR_TO_CHALLENGER' as const,
  inputValidation: inputValidation(),
  blindValidation: blind(),
  walkForward: walkForward(),
  monteCarlo: monteCarlo(),
  costStressVerdict: 'PASS' as const,
  auditCoverage: 0.98,
  rating: rating('A0'),
  researchConfigurationId: 'rcfg-v1-0123456789abcdef',
  parity: { policyObserved: 25, policyRejected: 0, targetObserved: 25, targetRejected: 0, adapterObserved: 8, adapterRejected: 0 },
});

test('all evidence gates PASS for a Challenger promotion candidate', () => {
  const result = buildStrategyPromotionEligibility(passingInput());
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.eligible, true);
  assert.equal(result.minimumGrade, 'A-');
  assert.equal(result.blockers.length, 0);
  assert.equal(result.insufficientEvidence.length, 0);
  assert.equal(result.promotionAuthority, false);
  assert.equal(result.executionAuthority, false);
  assert.equal(result.liveDeploymentAuthority, false);
});

test('one observed adapter parity mismatch blocks promotion regardless of rating', () => {
  const input = passingInput();
  input.parity.adapterRejected = 1;
  input.rating = rating('AAA+');
  const result = buildStrategyPromotionEligibility(input);
  assert.equal(result.verdict, 'BLOCKED');
  assert.ok(result.blockers.includes('ADAPTER_PARITY'));
  assert.equal(result.eligible, false);
});

test('insufficient parity depth is distinguished from a failed parity observation', () => {
  const input = passingInput();
  input.parity = { policyObserved: 3, policyRejected: 0, targetObserved: 3, targetRejected: 0, adapterObserved: 1, adapterRejected: 0 };
  const result = buildStrategyPromotionEligibility(input);
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
  assert.ok(result.insufficientEvidence.includes('POLICY_PARITY'));
  assert.ok(result.insufficientEvidence.includes('TARGET_PARITY'));
  assert.ok(result.insufficientEvidence.includes('ADAPTER_PARITY'));
});

test('stage-aware minimum grade blocks a rating below the transition floor', () => {
  const input = passingInput();
  input.stage = 'CHALLENGER_TO_CHAMPION_CANDIDATE';
  input.rating = rating('A+');
  const result = buildStrategyPromotionEligibility(input);
  assert.equal(result.minimumGrade, 'AA-');
  assert.equal(result.verdict, 'BLOCKED');
  assert.ok(result.blockers.includes('RATING_HARD_GATE'));
});

test('missing reproducible dataset/config lineage is insufficient evidence', () => {
  const input = passingInput();
  input.researchConfigurationId = null;
  const result = buildStrategyPromotionEligibility(input);
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
  assert.ok(result.insufficientEvidence.includes('REPRODUCIBLE_LINEAGE'));
});

test('ledger parity summary counts policy, target and adapter mismatches separately', () => {
  const events = [
    { type: 'SIGNAL', payload: { independentPolicyParity: { status: 'PASS' }, targetPipelineParity: { status: 'PASS' } } },
    { type: 'SIGNAL', payload: { independentPolicyParity: { status: 'REJECT' }, targetPipelineParity: { status: 'PASS' } } },
    { type: 'ORDER_FILLED', payload: { executionAdapterParity: { status: 'PASS' } } },
    { type: 'ORDER_FILLED', payload: { executionAdapterParity: { status: 'REJECT' } } },
  ].map((event, index) => ({ id: `e${index}`, sequence: index + 1, timestamp: 1_700_000_000_000 + index, strategyVersion: 'BO-TEST', ...event })) as TradingLedgerEvent[];

  assert.deepEqual(summarizePromotionParityFromLedger(events), {
    policyObserved: 2, policyRejected: 1,
    targetObserved: 2, targetRejected: 0,
    adapterObserved: 2, adapterRejected: 1,
  });
});
