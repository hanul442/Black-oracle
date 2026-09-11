import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalEventRow } from './eventLedger';
import { resolveObservedEntryTraceId } from './decisionReplay';
import {
  buildDirectionalOutcomeCalibration,
  buildEmpiricalReturnDistribution,
  extractDirectionalForecast,
} from './eventLedgerForecastCalibration';

const baseEvent = (overrides: Partial<CanonicalEventRow>): CanonicalEventRow => ({
  id: 'event',
  eventKey: 'event-key',
  occurredAt: 100,
  recordedAt: 101,
  runtimeId: 'black-oracle-paper',
  eventType: 'DECISION',
  eventName: 'DECISION_ENTER',
  market: 'KRW-BTC',
  strategyId: null,
  strategyVersion: null,
  action: 'ENTER',
  summary: 'Decision.',
  reason: null,
  severity: 'INFO',
  authority: 'observed',
  executionAuthority: false,
  source: 'paper_runtime',
  trace: {},
  links: {},
  schemaVersion: 1,
  ...overrides,
});

const entryTraceId = 'black-oracle-paper:KRW-BTC:100';
const exitTraceId = 'black-oracle-paper:KRW-BTC:200';

const evidenceEvent = baseEvent({
  id: 'evidence',
  eventKey: 'evidence',
  eventType: 'EVIDENCE',
  eventName: 'EVIDENCE_LINKED',
  trace: {
    traceId: entryTraceId,
    forecast: {
      available: true,
      direction: 'BULLISH',
      probabilityBullish: 0.72,
      probabilityBearish: 0.28,
      confidence: 0.64,
      uncertainty: 0.36,
      asOf: 100,
    },
  },
});

const outcomeEvent = baseEvent({
  id: 'outcome',
  eventKey: 'outcome',
  occurredAt: 200,
  eventType: 'OUTCOME',
  eventName: 'PAPER_TRADE_CLOSED_OUTCOME',
  action: 'CLOSED',
  trace: {
    traceId: exitTraceId,
    openedAt: 100,
    closedAt: 200,
    returnPct: 0.04,
  },
  links: { entryTraceId, tradeId: 'trade-1' },
});

test('extractDirectionalForecast reads the source-backed Evidence forecast for a trace', () => {
  const forecast = extractDirectionalForecast([evidenceEvent, outcomeEvent], entryTraceId);
  assert.equal(forecast?.available, true);
  assert.equal(forecast?.probabilityBullish, 0.72);
  assert.equal(forecast?.direction, 'BULLISH');
});

test('directional outcome calibration computes Brier score only from observed outcome and recorded probability', () => {
  const calibration = buildDirectionalOutcomeCalibration([evidenceEvent, outcomeEvent], outcomeEvent);
  assert.ok(calibration);
  assert.equal(calibration.entryTraceId, entryTraceId);
  assert.equal(calibration.outcomeTraceId, exitTraceId);
  assert.equal(calibration.actualDirection, 'BULLISH');
  assert.equal(calibration.directionCorrect, true);
  assert.equal(calibration.brierScore, 0.0784);
  assert.equal(calibration.absoluteProbabilityError, 0.28);
  assert.equal(calibration.holdingPeriodMs, 100);
});

test('empirical distribution hard-gates quantiles until enough completed comparable outcomes exist', () => {
  const sample = buildDirectionalOutcomeCalibration([evidenceEvent, outcomeEvent], outcomeEvent)!;
  const seven = Array.from({ length: 7 }, (_, index) => ({
    ...sample,
    tradeId: `trade-${index}`,
    predictedBullish: 0.7 + index * 0.005,
    realizedReturnPct: (index - 3) / 100,
  }));
  const blocked = buildEmpiricalReturnDistribution(seven, 0.72, 8);
  assert.equal(blocked.available, false);
  assert.equal(blocked.sampleSize, 7);
  assert.equal(blocked.quantiles, null);

  const eight = [...seven, { ...sample, tradeId: 'trade-8', predictedBullish: 0.74, realizedReturnPct: 0.05 }];
  const ready = buildEmpiricalReturnDistribution(eight, 0.72, 8);
  assert.equal(ready.available, true);
  assert.equal(ready.sampleSize, 8);
  assert.ok(ready.quantiles);
  assert.equal(ready.probabilityBucket?.lower, 0.6);
  assert.equal(ready.probabilityBucket?.upper, 0.8);
  assert.ok((ready.quantiles?.p10 ?? 1) <= (ready.quantiles?.p50 ?? 0));
  assert.ok((ready.quantiles?.p50 ?? 1) <= (ready.quantiles?.p90 ?? 0));
});

test('replay recovers the canonical entry trace from observed openedAt when legacy entryTraceId does not resolve', () => {
  const actualEntryTraceId = 'black-oracle-paper:KRW-BTC:5000';
  const entryDecisionEvent = baseEvent({
    id: 'entry-decision',
    eventKey: 'entry-decision',
    occurredAt: 5_000,
    eventType: 'DECISION',
    eventName: 'DECISION_ENTER',
    action: 'ENTER',
    trace: { traceId: actualEntryTraceId },
  });
  const legacyOutcome = baseEvent({
    id: 'legacy-outcome',
    eventKey: 'legacy-outcome',
    occurredAt: 20_000,
    eventType: 'OUTCOME',
    eventName: 'PAPER_TRADE_CLOSED_OUTCOME',
    action: 'CLOSED',
    trace: { traceId: 'exit-trace', openedAt: 5_120, closedAt: 20_000, returnPct: 0.01 },
    links: { entryTraceId: 'black-oracle-paper:KRW-BTC:wrong-analysis-time' },
  });

  const resolved = resolveObservedEntryTraceId(legacyOutcome, [entryDecisionEvent]);
  assert.equal(resolved.traceId, actualEntryTraceId);
  assert.equal(resolved.method, 'OPENED_AT_NEAREST_DECISION');
});
