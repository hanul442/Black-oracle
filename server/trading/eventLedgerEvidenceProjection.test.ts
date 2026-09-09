import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceAndEquityCanonicalEvents } from '../eventLedgerEvidenceProjection';

test('projects NARS pipeline activity and evidence coverage request', () => {
  const events = buildEvidenceAndEquityCanonicalEvents({
    finishedAt: 1_788_934_600_000,
    evidenceOps: { importedBeforeConsume: 1, consumedPackets: 2, importedAfterConsume: 3, acquisitionRequests: 1, acquisitionSourcesIngested: 2, errors: [] },
    markets: [{ timestamp: 1_788_934_590_000, market: 'KRW-WLD', decision: 'NO_TRADE', evidenceActiveCount: 0, strategyDisposition: 'TREND_MOMENTUM', reasons: ['Evidence coverage request req-wld-1 queued for NARS acquisition/re-analysis.'] }],
  }, 'black-oracle-paper');

  assert.equal(events.some((event) => event.eventName === 'NARS_EVIDENCE_PIPELINE_ACTIVITY' && event.eventType === 'EVIDENCE'), true);
  const request = events.find((event) => event.eventName === 'EVIDENCE_COVERAGE_REQUESTED');
  assert.equal(request?.market, 'KRW-WLD');
  assert.equal(request?.executionAuthority, false);
  assert.deepEqual(request?.links, { requestKey: 'req-wld-1' });
});

test('projects equity research decision and linked evidence without execution authority', () => {
  const events = buildEvidenceAndEquityCanonicalEvents({
    finishedAt: 1_788_934_600_000,
    evidenceOps: {},
    markets: [],
    equityCycle: { finishedAt: 1_788_934_599_000, decisions: [{ market: 'KRX-000660', name: 'SK hynix', action: 'RESEARCH_HOLD', price: 310000, technicalScore: 71, evidenceScore: 64, evidenceIds: ['nars:packet-1:KRX-000660'], reasons: ['Research-only equity gate remains closed.'] }] },
  }, 'black-oracle-paper');

  const decision = events.find((event) => event.eventName === 'EQUITY_RESEARCH_DECISION');
  const evidence = events.find((event) => event.eventName === 'EQUITY_EVIDENCE_LINKED');
  assert.equal(decision?.eventType, 'DECISION');
  assert.equal(decision?.executionAuthority, false);
  assert.equal(evidence?.eventType, 'EVIDENCE');
  assert.deepEqual(evidence?.links, { evidenceIds: ['nars:packet-1:KRX-000660'] });
});
