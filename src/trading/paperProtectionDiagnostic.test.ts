import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPaperProtectionDiagnostic } from './paperProtectionDiagnostic';
import type { CanonicalPaperEventRow } from './canonicalPaperProtectionReplay';

const runtimeId = 'black-oracle-paper-vnext-100m-v03';

const row = (
  sequence: number,
  ledgerType: 'POSITION_UPDATED' | 'ORDER_FILLED',
  payload: Record<string, unknown>,
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

test('builds an auditable compact diagnostic without mutating source rows', () => {
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
  const before = JSON.stringify(rows);

  const report = buildPaperProtectionDiagnostic(runtimeId, rows);

  assert.equal(report.runtimeId, runtimeId);
  assert.equal(report.sourceRows, 2);
  assert.equal(report.acceptedRows, 2);
  assert.equal(report.rejectedRows, 0);
  assert.equal(report.observations, 1);
  assert.equal(report.changedExits, 1);
  assert.equal(report.byTrigger.TAKE_PROFIT_1, 1);
  assert.equal(report.lineage[0]?.ledgerEventId, 'ledger-2');
  assert.equal(report.lineage[0]?.ledgerSequence, 2);
  assert.ok(report.favorableOvershootRemoved > 0);
  assert.ok(report.grossExitValueDelta < 0);
  assert.equal(JSON.stringify(rows), before);
});

test('surfaces fail-closed canonical rejection counts', () => {
  const rows: CanonicalPaperEventRow[] = [
    row(1, 'POSITION_UPDATED', positionPayload),
    { runtime_id: 'other-runtime', event_name: 'ORDER_FILLED', trace: null },
  ];

  const report = buildPaperProtectionDiagnostic(runtimeId, rows);
  assert.equal(report.sourceRows, 2);
  assert.equal(report.acceptedRows, 1);
  assert.equal(report.rejectedRows, 1);
  assert.equal(report.rejectionReasons.RUNTIME_MISMATCH, 1);
  assert.equal(report.observations, 0);
});
