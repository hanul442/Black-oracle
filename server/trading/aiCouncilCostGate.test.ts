import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterCycleForCostGatedAiCouncil,
  isRoutineFailClosedRiskRejection,
} from './aiCouncilCostGate';
import type { OperationalCouncilTrace } from './aiCouncilAdjudicator';

const trace = (overrides: Partial<OperationalCouncilTrace> = {}): OperationalCouncilTrace => ({
  timestamp: 1_788_929_610_564,
  market: 'KRW-ETH',
  action: 'NO_TRADE',
  oracleTradeScore: 65,
  confidence: 0.82,
  regime: 'RANGE',
  regimeConfidence: 0.58,
  riskDisposition: 'REJECT',
  eventScore: null,
  evidenceActiveCount: 0,
  evidenceContradictionCount: 0,
  evidenceIds: [],
  strategyDisposition: 'BLENDED',
  council: {
    verdict: 'REJECT',
    approveCount: 1,
    cautionCount: 1,
    rejectCount: 1,
    abstainCount: 2,
    members: [
      { role: 'TECHNICAL', vote: 'ABSTAIN', confidence: 0.82, reasons: ['technical'] },
      { role: 'REGIME', vote: 'CAUTION', confidence: 0.58, reasons: ['range'] },
      { role: 'EVIDENCE', vote: 'ABSTAIN', confidence: 0, reasons: ['none'] },
      { role: 'RISK', vote: 'REJECT', confidence: 0.95, reasons: ['Paper portfolio open-position limit rejected a new entry.'] },
      { role: 'SKEPTIC', vote: 'APPROVE', confidence: 0.45, reasons: ['no objection'] },
    ],
  },
  primaryReason: 'Paper portfolio open-position limit rejected a new entry.',
  reasons: ['Paper portfolio open-position limit rejected a new entry.'],
  riskReasons: ['Paper portfolio open-position limit rejected a new entry.'],
  ...overrides,
});

test('suppresses routine NO_TRADE where hard Risk is the only reject', () => {
  assert.equal(isRoutineFailClosedRiskRejection(trace()), true);
  assert.equal(filterCycleForCostGatedAiCouncil({ markets: [trace()] }).markets?.length, 0);
});

test('does not suppress actual ENTER or EXIT material events', () => {
  assert.equal(isRoutineFailClosedRiskRejection(trace({ action: 'ENTER', riskDisposition: 'APPROVE' })), false);
  assert.equal(isRoutineFailClosedRiskRejection(trace({ action: 'EXIT', riskDisposition: 'APPROVE' })), false);
});

test('does not suppress Evidence contradictions', () => {
  assert.equal(isRoutineFailClosedRiskRejection(trace({ evidenceActiveCount: 2, evidenceContradictionCount: 1 })), false);
});

test('does not suppress an independent non-risk REJECT', () => {
  const base = trace();
  const withIndependentReject: OperationalCouncilTrace = {
    ...base,
    council: {
      ...base.council,
      rejectCount: 2,
      members: base.council.members.map((member) => member.role === 'REGIME' ? { ...member, vote: 'REJECT' } : member),
    },
  };
  assert.equal(isRoutineFailClosedRiskRejection(withIndependentReject), false);
});
