import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractLongProtectionHistoryObservations,
  replayLongProtectionHistory,
} from './paperProtectionHistoryReplay';
import type { PaperPosition, TradingLedgerEvent } from './types';

const position = (overrides: Partial<PaperPosition> = {}): PaperPosition => ({
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
  ...overrides,
});

const event = (
  sequence: number,
  type: TradingLedgerEvent['type'],
  payload: Record<string, unknown>,
): TradingLedgerEvent => ({
  id: `e-${sequence}`,
  sequence,
  timestamp: sequence * 1_000,
  type,
  strategyVersion: 'test-v1',
  payload,
});

const sellFill = (
  sequence: number,
  observedReferencePrice: number,
  quantity: number,
  partialExit: boolean,
  slippageBps = 8,
) => event(sequence, 'ORDER_FILLED', {
  market: 'KRW-TEST',
  side: 'SELL',
  quantity,
  fillPrice: observedReferencePrice * (1 - slippageBps / 10_000),
  slippageBps,
  partialExit,
});

test('extracts TP1 from the latest preceding position snapshot and preserves lineage', () => {
  const ledger = [
    event(1, 'POSITION_UPDATED', { market: 'KRW-TEST', position: position() }),
    sellFill(2, 110, 4, true),
    event(3, 'POSITION_UPDATED', { market: 'KRW-TEST', position: position({ quantity: 6, takeProfit1Taken: true }) }),
  ];

  const result = extractLongProtectionHistoryObservations(ledger);
  assert.equal(result.skippedSellFills, 0);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.trigger, 'TAKE_PROFIT_1');
  assert.equal(result.observations[0]?.triggerPrice, 105);
  assert.equal(result.observations[0]?.ledgerEventId, 'e-2');
  assert.equal(result.observations[0]?.ledgerSequence, 2);
  assert.ok(Math.abs((result.observations[0]?.observedPrice ?? 0) - 110) < 1e-9);
});

test('classifies TP2 before TP1 when an observation crosses both targets', () => {
  const ledger = [
    event(1, 'POSITION_UPDATED', { market: 'KRW-TEST', position: position() }),
    sellFill(2, 130, 10, false),
  ];

  const result = replayLongProtectionHistory(ledger);
  assert.equal(result.summary.observations, 1);
  assert.equal(result.summary.byTrigger.TAKE_PROFIT_2, 1);
  assert.equal(result.summary.changedObservations, 1);
  assert.ok(result.summary.grossExitValueDelta < 0);
  assert.ok(result.summary.favorableOvershootRemoved > 0);
});

test('keeps adverse stop-loss lag instead of improving it retrospectively', () => {
  const ledger = [
    event(1, 'POSITION_UPDATED', { market: 'KRW-TEST', position: position() }),
    sellFill(2, 90, 10, false),
  ];

  const result = replayLongProtectionHistory(ledger);
  assert.equal(result.summary.byTrigger.STOP_LOSS, 1);
  assert.equal(result.summary.changedObservations, 0);
  assert.equal(result.summary.grossExitValueDelta, 0);
  assert.equal(result.summary.favorableOvershootRemoved, 0);
});

test('skips discretionary exits and malformed SELL fills rather than inventing protection lineage', () => {
  const ledger = [
    event(1, 'POSITION_UPDATED', { market: 'KRW-TEST', position: position() }),
    sellFill(2, 100, 10, false),
    event(3, 'ORDER_FILLED', {
      market: 'KRW-TEST',
      side: 'SELL',
      quantity: 1,
      fillPrice: 99,
    }),
  ];

  const result = extractLongProtectionHistoryObservations(ledger);
  assert.equal(result.observations.length, 0);
  assert.equal(result.skippedSellFills, 2);
});

test('uses the most recent dynamic protection snapshot for later exits', () => {
  const ledger = [
    event(1, 'POSITION_UPDATED', { market: 'KRW-TEST', position: position() }),
    event(2, 'POSITION_UPDATED', {
      market: 'KRW-TEST',
      position: position({ stopLossPrice: 101, takeProfit2Price: 125, takeProfitPrice: 125, protectionRevision: 2 }),
    }),
    sellFill(3, 100, 10, false),
  ];

  const result = extractLongProtectionHistoryObservations(ledger);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.trigger, 'STOP_LOSS');
  assert.equal(result.observations[0]?.triggerPrice, 101);
});

test('does not mutate the supplied ledger while ordering by canonical sequence', () => {
  const ledger = [
    sellFill(2, 110, 4, true),
    event(1, 'POSITION_UPDATED', { market: 'KRW-TEST', position: position() }),
  ];
  const originalIds = ledger.map((item) => item.id);

  const result = extractLongProtectionHistoryObservations(ledger);
  assert.deepEqual(ledger.map((item) => item.id), originalIds);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.ledgerEventId, 'e-2');
});
