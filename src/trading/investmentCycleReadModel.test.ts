import test from 'node:test';
import assert from 'node:assert/strict';
import { projectInvestmentCycleEvents, stageForCanonicalCycleEvent } from './investmentCycleReadModel';

const NOW = 1_789_000_000_000;
const event = (overrides: Record<string, unknown> = {}) => ({
  eventType: 'SYSTEM',
  eventName: 'UNKNOWN',
  occurredAt: NOW - 60_000,
  runtimeId: 'black-oracle-paper-v9-multiasset',
  market: 'KRX-000660',
  trace: {},
  ...overrides,
});

test('legacy deterministic council never masquerades as V10 Investment Committee', () => {
  assert.equal(stageForCanonicalCycleEvent(event({
    eventType: 'COUNCIL',
    eventName: 'DETERMINISTIC_COUNCIL_REVIEWED',
  })), null);

  const projection = projectInvestmentCycleEvents([
    event({ eventType: 'COUNCIL', eventName: 'DETERMINISTIC_COUNCIL_REVIEWED' }),
  ], { now: NOW });
  assert.equal(projection.stages.find((stage) => stage.id === 'NOMINATION')?.status, 'WAITING');
  assert.equal(projection.stages.find((stage) => stage.id === 'CROSS_REVIEW')?.status, 'WAITING');
});

test('maps canonical V10 stages and builds candidate funnel without inventing survivors', () => {
  const projection = projectInvestmentCycleEvents([
    event({ eventType: 'EVIDENCE', eventName: 'NARS_EVIDENCE_PIPELINE_ACTIVITY' }),
    event({ eventName: 'V10_MARKET_STATE_OBSERVED', trace: { horizon: 'SHORT' } }),
    event({ eventName: 'V10_SECTOR_STRENGTH_OBSERVED', trace: { horizon: 'SHORT' } }),
    event({ eventName: 'V10_UNIVERSE_CANDIDATE_OBSERVED', trace: { horizon: 'SHORT' } }),
    event({ eventType: 'COUNCIL', eventName: 'V10_COMMITTEE_NOMINATION', trace: { horizon: 'SHORT' } }),
    event({ eventType: 'COUNCIL', eventName: 'V10_CROSS_REVIEW_COMPLETED', trace: { horizon: 'SHORT' } }),
    event({ eventType: 'COUNCIL', eventName: 'V10_RED_TEAM_REVIEWED', trace: { horizon: 'SHORT' } }),
    event({ eventType: 'COUNCIL', eventName: 'V10_HEAD_COUNCIL_RANKED', action: 'SURVIVED', trace: { horizon: 'SHORT', survived: true } }),
    event({ eventType: 'DECISION', eventName: 'V10_HORIZON_PLAN_BUILT', action: 'EXECUTABLE', trace: { horizon: 'SHORT', executableCandidate: true } }),
    event({ eventType: 'RISK', eventName: 'RISK_GATE_EVALUATED', trace: { horizon: 'SHORT' } }),
    event({ eventType: 'TRADE', eventName: 'PAPER_TRADE_ENTERED', trace: { horizon: 'SHORT' } }),
    event({ eventType: 'OUTCOME', eventName: 'PAPER_TRADE_OUTCOME', trace: { horizon: 'SHORT' } }),
  ], { now: NOW });

  assert.equal(projection.stages.every((stage) => stage.status === 'LIVE'), true);
  assert.deepEqual(projection.funnel, {
    universeObserved: 1,
    nominated: 1,
    crossReviewed: 1,
    survived: 1,
    executablePlan: 1,
    trades: 1,
    outcomes: 1,
  });
  assert.equal(projection.horizons.find((item) => item.horizon === 'SHORT')?.count, 11);
  assert.equal(projection.blockers.length, 0);
});

test('nomination readiness blocker makes the stage observable without inflating nominated funnel count', () => {
  const projection = projectInvestmentCycleEvents([
    event({
      eventType: 'COUNCIL',
      eventName: 'V10_NOMINATION_READINESS_BLOCKED',
      action: 'BLOCKED',
      reason: 'Crypto-linked equity classification is UNKNOWN.',
      trace: { horizon: 'SHORT', nominationReady: false, dataGaps: ['Crypto-linked equity classification is UNKNOWN.'] },
    }),
  ], { now: NOW });

  assert.equal(projection.stages.find((stage) => stage.id === 'NOMINATION')?.status, 'LIVE');
  assert.equal(projection.funnel.nominated, 0);
  assert.equal(projection.blockers.some((value) => value.includes('Crypto-linked')), true);
});

test('missing V10 producers remain explicit WAITING blockers and DATA_GAP is surfaced', () => {
  const projection = projectInvestmentCycleEvents([
    event({
      eventName: 'V10_UNIVERSE_CANDIDATE_OBSERVED',
      reason: 'DATA_GAP: crypto exposure classification is unavailable.',
    }),
  ], { now: NOW });

  assert.equal(projection.stages.find((stage) => stage.id === 'UNIVERSE_GATE')?.status, 'LIVE');
  assert.equal(projection.stages.find((stage) => stage.id === 'HEAD_COUNCIL')?.status, 'WAITING');
  assert.equal(projection.blockers.some((value) => value.includes('Head Council')), true);
  assert.equal(projection.blockers.some((value) => value.includes('DATA_GAP')), true);
});

test('only explicit valid horizon trace values count toward horizon coverage', () => {
  const projection = projectInvestmentCycleEvents([
    event({ eventName: 'V10_UNIVERSE_CANDIDATE_OBSERVED', trace: { horizon: 'LONG' } }),
    event({ eventName: 'V10_UNIVERSE_CANDIDATE_OBSERVED', market: 'KRX-005930', trace: { horizon: 'NOT_A_HORIZON' } }),
  ], { now: NOW });

  assert.equal(projection.horizons.find((item) => item.horizon === 'LONG')?.count, 1);
  assert.equal(projection.horizons.reduce((sum, item) => sum + item.count, 0), 1);
});
