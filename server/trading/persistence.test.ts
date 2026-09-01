import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { JsonTradingCheckpointStore, type TradingRuntimeCheckpoint } from './persistence';

const buildCheckpoint = (): TradingRuntimeCheckpoint => ({
  schemaVersion: 1,
  savedAt: 123456,
  reason: 'test',
  session: {
    schemaVersion: 1,
    portfolio: {
      initialEquity: 1_000_000,
      cash: 1_000_000,
      dailyStartEquity: 1_000_000,
      realizedPnl: 0,
      feesPaid: 0,
      peakEquity: 1_000_000,
      positions: [],
      equityCurve: [],
    },
    markPrices: [],
    entryMetadata: [],
    closedTrades: [],
    ledger: [],
    processedOrderIds: [],
  },
  evidence: [],
  loop: {
    schemaVersion: 1,
    running: true,
    config: {
      intervalMs: 900_000,
      maxMarkets: 6,
      maxOpenPositions: 4,
    },
    cycleCount: 12,
    lastCycle: null,
  },
});

test('JSON checkpoint store roundtrips runtime state', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'black-oracle-trading-'));
  const filePath = path.join(directory, 'runtime.json');
  const store = new JsonTradingCheckpointStore(filePath);

  try {
    const checkpoint = buildCheckpoint();
    await store.save(checkpoint);
    const restored = await store.load();

    assert.deepEqual(restored, checkpoint);
    assert.equal(store.status().writes, 1);
    assert.equal(store.status().restores, 1);
    assert.equal(store.status().lastError, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing checkpoint returns null without marking persistence faulty', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'black-oracle-trading-missing-'));
  const filePath = path.join(directory, 'does-not-exist.json');
  const store = new JsonTradingCheckpointStore(filePath);

  try {
    const restored = await store.load();
    assert.equal(restored, null);
    assert.equal(store.status().lastError, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
