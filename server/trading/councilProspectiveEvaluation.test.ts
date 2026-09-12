import assert from 'node:assert/strict';
import test from 'node:test';
import type { CouncilCounterfactualReport } from './councilCounterfactual';
import { buildCouncilProspectiveEvaluation } from './councilProspectiveEvaluation';

const report = (overrides: Partial<CouncilCounterfactualReport> = {}): CouncilCounterfactualReport => ({
  runtimeId: 'black-oracle-strategy-s2',
  status: 'EARLY_OBSERVATION',
  closedOutcomeCount: 4,
  eligibleSampleCount: 4,
  excludedMissingLineage: 0,
  excludedMissingEntryReview: 0,
  shadowBlockSignalCount: 3,
  candidateAvoidedLossKrw: 300_000,
  candidateFalseBlockCostKrw: 120_000,
  candidateNetBenefitKrw: 180_000,
  observations: [
    {
      tradeId: 'loss-reject-dissent', market: 'KRW-BTC', entryTraceId: 't1', outcomeTraceId: 'o1',
      netPnl: -200_000, returnPct: -0.02, deterministicVerdict: 'REJECT', aiStance: 'DISSENT',
      shadowBlockSignal: true, blockSignalSources: ['DETERMINISTIC_COUNCIL_REJECT', 'AI_COUNCIL_DISSENT'],
      classification: 'CANDIDATE_AVOIDED_LOSS', candidateAvoidedLossKrw: 200_000, candidateFalseBlockCostKrw: 0,
    },
    {
      tradeId: 'win-reject-agree', market: 'KRW-ETH', entryTraceId: 't2', outcomeTraceId: 'o2',
      netPnl: 120_000, returnPct: 0.012, deterministicVerdict: 'REJECT', aiStance: 'AGREE',
      shadowBlockSignal: true, blockSignalSources: ['DETERMINISTIC_COUNCIL_REJECT'],
      classification: 'CANDIDATE_FALSE_BLOCK_COST', candidateAvoidedLossKrw: 0, candidateFalseBlockCostKrw: 120_000,
    },
    {
      tradeId: 'loss-approve-dissent', market: 'KRW-XRP', entryTraceId: 't3', outcomeTraceId: 'o3',
      netPnl: -100_000, returnPct: -0.01, deterministicVerdict: 'APPROVE', aiStance: 'DISSENT',
      shadowBlockSignal: true, blockSignalSources: ['AI_COUNCIL_DISSENT'],
      classification: 'CANDIDATE_AVOIDED_LOSS', candidateAvoidedLossKrw: 100_000, candidateFalseBlockCostKrw: 0,
    },
    {
      tradeId: 'win-approve-agree', market: 'KRW-SOL', entryTraceId: 't4', outcomeTraceId: 'o4',
      netPnl: 80_000, returnPct: 0.008, deterministicVerdict: 'APPROVE', aiStance: 'AGREE',
      shadowBlockSignal: false, blockSignalSources: [],
      classification: 'NO_SHADOW_BLOCK_SIGNAL', candidateAvoidedLossKrw: 0, candidateFalseBlockCostKrw: 0,
    },
  ],
  causalClaimAllowed: false,
  policyChangeAuthority: false,
  executionAuthority: false,
  note: 'diagnostic',
  ...overrides,
});

test('prospective evaluation exposes outcome-linked shadow metrics without granting authority', () => {
  const evaluation = buildCouncilProspectiveEvaluation(report());

  assert.equal(evaluation.status, 'OBSERVING');
  assert.equal(evaluation.metrics.lineageCoverage.value, 1);
  assert.equal(evaluation.metrics.shadowBlockSignalRate.value, 0.75);
  assert.equal(evaluation.metrics.candidateAvoidedLossShare.value, 2 / 3);
  assert.equal(evaluation.metrics.candidateFalseBlockShare.value, 1 / 3);
  assert.equal(evaluation.metrics.deterministicRejectLossShare.value, 0.5);
  assert.equal(evaluation.metrics.aiDissentLossShare.value, 1);
  assert.equal(evaluation.metrics.hardCouncilAiDisagreementRate.value, 0.5);
  assert.equal(evaluation.metrics.candidateNetBenefitKrw.value, 180_000);
  assert.equal(evaluation.causalClaimAllowed, false);
  assert.equal(evaluation.policyChangeAuthority, false);
  assert.equal(evaluation.executionAuthority, false);
  assert.ok(evaluation.missingProspectiveMetrics.some((item) => item.id === 'ROUND0_CALIBRATION'));
  assert.ok(evaluation.missingProspectiveMetrics.some((item) => item.id === 'RED_TEAM_INVALIDATION'));
});

test('prospective evaluation reports unavailable ratios instead of inventing values', () => {
  const evaluation = buildCouncilProspectiveEvaluation(report({
    status: 'INSUFFICIENT_DATA',
    closedOutcomeCount: 0,
    eligibleSampleCount: 0,
    shadowBlockSignalCount: 0,
    candidateAvoidedLossKrw: 0,
    candidateFalseBlockCostKrw: 0,
    candidateNetBenefitKrw: 0,
    observations: [],
  }));

  assert.equal(evaluation.status, 'NO_ELIGIBLE_OUTCOMES');
  assert.equal(evaluation.metrics.lineageCoverage.available, false);
  assert.equal(evaluation.metrics.lineageCoverage.value, null);
  assert.equal(evaluation.metrics.candidateNetBenefitKrw.available, false);
  assert.equal(evaluation.metrics.candidateNetBenefitKrw.value, null);
});
