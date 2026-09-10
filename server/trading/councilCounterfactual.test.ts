import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCouncilCounterfactualReport } from './councilCounterfactual';

const runtimeId = 'black-oracle-paper-s2-shadow';

const outcome = (entryTraceId: string | null, tradeId: string, netPnl: number) => ({
  id: `outcome-${tradeId}`,
  runtime_id: runtimeId,
  event_type: 'OUTCOME',
  event_name: 'PAPER_TRADE_CLOSED_OUTCOME',
  market: 'KRW-BTC',
  trace: {
    traceId: `${tradeId}:exit`,
    tradeId,
    netPnl,
    returnPct: netPnl / 10_000,
  },
  links: entryTraceId ? { entryTraceId, tradeId } : { tradeId },
});

const council = (traceId: string, verdict: string) => ({
  runtime_id: runtimeId,
  event_type: 'COUNCIL',
  event_name: 'DETERMINISTIC_COUNCIL_REVIEWED',
  execution_authority: false,
  trace: { traceId, verdict },
});

const ai = (reviewKey: string, stance: string) => ({
  runtime_id: runtimeId,
  review_key: reviewKey,
  ai_stance: stance,
  advisory_only: true,
  execution_authority: false,
});

test('counts hypothetical avoided loss and false-block opportunity only when entry review lineage exists', () => {
  const report = buildCouncilCounterfactualReport(
    runtimeId,
    [
      outcome('trace-loss', 'loss', -100),
      outcome('trace-win', 'win', 50),
      outcome('trace-agree', 'agree', -25),
      outcome('trace-missing', 'missing-review', -80),
      outcome(null, 'missing-lineage', -40),
    ],
    [
      council('trace-loss', 'REJECT'),
      council('trace-win', 'APPROVE'),
      council('trace-agree', 'APPROVE'),
    ],
    [
      ai('trace-win', 'DISSENT'),
      ai('trace-agree', 'AGREE'),
    ],
  );

  assert.equal(report.status, 'EARLY_OBSERVATION');
  assert.equal(report.eligibleSampleCount, 3);
  assert.equal(report.excludedMissingLineage, 1);
  assert.equal(report.excludedMissingEntryReview, 1);
  assert.equal(report.shadowBlockSignalCount, 2);
  assert.equal(report.candidateAvoidedLossKrw, 100);
  assert.equal(report.candidateFalseBlockCostKrw, 50);
  assert.equal(report.candidateNetBenefitKrw, 50);
  assert.equal(report.causalClaimAllowed, false);
  assert.equal(report.policyChangeAuthority, false);
  assert.equal(report.executionAuthority, false);

  const loss = report.observations.find((item) => item.tradeId === 'loss');
  assert.equal(loss?.classification, 'CANDIDATE_AVOIDED_LOSS');
  const win = report.observations.find((item) => item.tradeId === 'win');
  assert.equal(win?.classification, 'CANDIDATE_FALSE_BLOCK_COST');
  const agree = report.observations.find((item) => item.tradeId === 'agree');
  assert.equal(agree?.classification, 'NO_SHADOW_BLOCK_SIGNAL');
});

test('returns insufficient data instead of inferring missing historical Council state', () => {
  const report = buildCouncilCounterfactualReport(runtimeId, [outcome('trace-old', 'old', -100)], [], []);
  assert.equal(report.status, 'INSUFFICIENT_DATA');
  assert.equal(report.eligibleSampleCount, 0);
  assert.equal(report.excludedMissingEntryReview, 1);
  assert.equal(report.candidateAvoidedLossKrw, 0);
});
