import assert from 'node:assert/strict';
import test from 'node:test';
import { replayCanonicalPaperProtectionEvents, type CanonicalPaperEventRow } from './canonicalPaperProtectionReplay';

const runtimeId = 'black-oracle-paper-vnext-100m-v03';

const row = (
  sequence: number,
  ledgerType: 'POSITION_UPDATED' | 'ORDER_FILLED',
  payload: Record<string, unknown>,
  overrides: Partial<CanonicalPaperEventRow> = {},
): CanonicalPaperEventRow => ({
  runtime_id: runtimeId,
  occurred_at: new Date(sequence * 1_000).toISOString(),
  event_name: ledgerType,
  strategy_version: 'BO-UNIFIED-v0.3.0',
  trace: {
    payload,
    sequence,
    ledgerType,
    ledgerEventId: `ledger-${sequence}`,
    strategyVersion: 'BO-UNIFIED-v0.3.0',
  },
  ...overrides,
});

const positionPayload = {
  market: 'KRW-TEST',
  position: {
    market: 'KRW-TEST',
    quantity: 10,
    initialQuantity: 10,
    averageCost: 100,
    entryPrice: 100,
    openedAt: 1,
    updatedAt: 1,
    stopLossPrice: 95,
    takeProfitPrice: 120,
    takeProfit1Price: 105,
    takeProfit2Price: 120,
    takeProfit1Fraction: 0.4,
    takeProfit1Taken: false,
    protectionBasis: 'ATR',
    protectionRevision: 0,
  },
};

test('replays a canonical TP1 SELL through preserved ledger lineage', () => {
  const rows = [
    row(1, 'POSITION_UPDATED', positionPayload),
    row(2, 'ORDER_FILLED', {
      market: 'KRW-TEST',
      side: 'SELL',
      quantity: 4,
      fillPrice: 109.912,
      slippageBps: 8,
      partialExit: true,
      timestamp: 2_000,
    }),
  ];

  const result = replayCanonicalPaperProtectionEvents(runtimeId, rows);
  assert.equal(result.acceptedRows, 2);
  assert.equal(result.rejectedRows, 0);
  assert.equal(result.report.summary.observations, 1);
  assert.equal(result.report.summary.byTrigger.TAKE_PROFIT_1, 1);
  assert.equal(result.report.observations[0]?.ledgerEventId, 'ledger-2');
  assert.equal(result.report.observations[0]?.ledgerSequence, 2);
});

test('folds compact dynamic protection rows before classifying the exit', () => {
  const rows = [
    row(1, 'POSITION_UPDATED', positionPayload),
    row(2, 'POSITION_UPDATED', {
      market: 'KRW-TEST',
      currentPrice: 103,
      stopLossPrice: 101,
      takeProfit2Price: 120,
      dynamicProtection: true,
      protectionRevision: 1,
    }),
    row(3, 'ORDER_FILLED', {
      market: 'KRW-TEST',
      side: 'SELL',
      quantity: 10,
      fillPrice: 99.9 * (1 - 8 / 10_000),
      slippageBps: 8,
      partialExit: false,
      timestamp: 3_000,
    }),
  ];

  const result = replayCanonicalPaperProtectionEvents(runtimeId, rows);
  assert.equal(result.report.summary.byTrigger.STOP_LOSS, 1);
  assert.equal(result.report.observations[0]?.triggerPrice, 101);
});

test('fails closed on cross-runtime, malformed, and mismatched canonical rows', () => {
  const rows: CanonicalPaperEventRow[] = [
    row(1, 'POSITION_UPDATED', positionPayload, { runtime_id: 'other-runtime' }),
    { runtime_id: runtimeId, event_name: 'POSITION_UPDATED', trace: null },
    row(2, 'ORDER_FILLED', { market: 'KRW-TEST' }, { event_name: 'POSITION_UPDATED' }),
    row(3, 'ORDER_FILLED', { market: 'KRW-TEST' }, {
      trace: { ledgerType: 'ORDER_FILLED', sequence: 3, payload: { market: 'KRW-TEST' } },
    }),
  ];

  const result = replayCanonicalPaperProtectionEvents(runtimeId, rows);
  assert.equal(result.acceptedRows, 0);
  assert.equal(result.rejectedRows, 4);
  assert.deepEqual(result.rejectionReasons, {
    RUNTIME_MISMATCH: 1,
    MISSING_TRACE: 1,
    EVENT_NAME_MISMATCH: 1,
    MALFORMED_LEDGER_TRACE: 1,
  });
});

test('does not mutate canonical source rows while replaying', () => {
  const rows = [
    row(1, 'POSITION_UPDATED', positionPayload),
    row(2, 'ORDER_FILLED', {
      market: 'KRW-TEST', side: 'SELL', quantity: 10, fillPrice: 92 * (1 - 8 / 10_000), slippageBps: 8,
    }),
  ];
  const before = JSON.stringify(rows);
  replayCanonicalPaperProtectionEvents(runtimeId, rows);
  assert.equal(JSON.stringify(rows), before);
});
