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

test('projects equity research, V10 candidate observation and linked evidence without execution authority', () => {
  const events = buildEvidenceAndEquityCanonicalEvents({
    finishedAt: 1_788_934_600_000,
    evidenceOps: {},
    markets: [],
    equityCycle: { finishedAt: 1_788_934_599_000, decisions: [{ market: 'KRX-000660', name: 'SK hynix', action: 'RESEARCH_HOLD', price: 310000, technicalScore: 71, evidenceScore: 64, evidenceIds: ['nars:packet-1:KRX-000660'], reasons: ['Research-only equity gate remains closed.'] }] },
  }, 'black-oracle-paper');

  const decision = events.find((event) => event.eventName === 'EQUITY_RESEARCH_DECISION');
  const observed = events.find((event) => event.eventName === 'V10_UNIVERSE_CANDIDATE_OBSERVED');
  const evidence = events.find((event) => event.eventName === 'EQUITY_EVIDENCE_LINKED');
  assert.equal(decision?.eventType, 'DECISION');
  assert.equal(decision?.executionAuthority, false);
  assert.equal(observed?.eventType, 'SYSTEM');
  assert.equal(observed?.executionAuthority, false);
  assert.equal(observed?.trace?.gateDisposition, 'OBSERVED_NOT_QUALIFIED');
  assert.equal(evidence?.eventType, 'EVIDENCE');
  assert.deepEqual(evidence?.links, { evidenceIds: ['nars:packet-1:KRX-000660'] });
});

test('projects large participant footprint only as a behavioral proxy', () => {
  const events = buildEvidenceAndEquityCanonicalEvents({
    finishedAt: 1_788_934_600_000,
    evidenceOps: {},
    markets: [],
    equityCycle: {
      finishedAt: 1_788_934_599_000,
      decisions: [{
        market: 'KRX-005930',
        action: 'RESEARCH_HOLD',
        relativeVolume: 2.4,
        priceVsVwapPct: 1.2,
        volumeAbsorptionScore: 78,
        absorptionCandidate: true,
      }],
    },
  }, 'black-oracle-paper');

  const footprint = events.find((event) => event.eventName === 'V10_LARGE_PARTICIPANT_FOOTPRINT_OBSERVED');
  assert.equal(footprint?.eventType, 'EVIDENCE');
  assert.equal(footprint?.action, 'BEHAVIOR_PROXY');
  assert.equal(footprint?.executionAuthority, false);
  assert.equal(footprint?.trace?.actorIdentityVerified, false);
  assert.match(String(footprint?.summary), /no actor identity or manipulation claim/i);
});
