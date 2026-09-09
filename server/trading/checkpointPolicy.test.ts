import assert from 'node:assert/strict';
import test from 'node:test';
import { compactPaperSessionCheckpoint, PAPER_CHECKPOINT_LEDGER_LIMIT } from './checkpointPolicy';
import type { PaperTradingSessionCheckpoint } from './paperSession';

const buildCheckpoint = (ledgerCount: number): PaperTradingSessionCheckpoint => ({
  schemaVersion: 1,
  portfolio: {
    initialEquity: 100_000_000,
    cash: 100_000_000,
    dailyStartEquity: 100_000_000,
    realizedPnl: 0,
    feesPaid: 0,
    peakEquity: 100_000_000,
    positions: [],
    equityCurve: [],
  },
  markPrices: [],
  entryMetadata: [],
  closedTrades: [],
  ledger: Array.from({ length: ledgerCount }, (_, index) => ({
    sequence: index + 1,
    timestamp: index + 1,
    type: 'SIGNAL',
    payload: { index },
  } as any)),
  processedOrderIds: [],
});

test('Paper checkpoint keeps only the newest bounded ledger tail', () => {
  const original = buildCheckpoint(PAPER_CHECKPOINT_LEDGER_LIMIT + 505);
  const compacted = compactPaperSessionCheckpoint(original);

  assert.equal(compacted.ledger.length, PAPER_CHECKPOINT_LEDGER_LIMIT);
  assert.equal((compacted.ledger[0] as any).sequence, 506);
  assert.equal((compacted.ledger.at(-1) as any).sequence, PAPER_CHECKPOINT_LEDGER_LIMIT + 505);
  assert.equal(original.ledger.length, PAPER_CHECKPOINT_LEDGER_LIMIT + 505);
});

test('Paper checkpoint compaction preserves portfolio and execution state', () => {
  const original = buildCheckpoint(10);
  original.portfolio.cash = 88_000_000;
  original.markPrices = [['KRW-BTC', 100_000_000]];
  original.processedOrderIds = ['order-1'];

  const compacted = compactPaperSessionCheckpoint(original);
  assert.equal(compacted.portfolio.cash, 88_000_000);
  assert.deepEqual(compacted.markPrices, [['KRW-BTC', 100_000_000]]);
  assert.deepEqual(compacted.processedOrderIds, ['order-1']);
  assert.equal(compacted.ledger.length, 10);
});
