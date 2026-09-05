import assert from 'node:assert/strict';
import test from 'node:test';
import { PaperLoopController, type PaperLoopCycleResult } from './paperLoop';

const makeCycle = (sequence: number): PaperLoopCycleResult => ({
  startedAt: sequence * 1_000,
  finishedAt: sequence * 1_000 + 500,
  scanned: 6,
  entered: sequence % 4 === 0 ? 1 : 0,
  exited: sequence % 7 === 0 ? 1 : 0,
  held: 2,
  noTrade: 4,
  errors: [],
  markets: [],
});

const config = {
  intervalMs: 15 * 60 * 1_000,
  maxMarkets: 6,
  maxOpenPositions: 4,
};

test('restore remains backward compatible when cycleHistory is absent', () => {
  const controller = new PaperLoopController();
  const latest = makeCycle(7);

  controller.restore({
    schemaVersion: 1,
    running: false,
    config,
    cycleCount: 7,
    lastCycle: latest,
    marketHistory: [],
  });

  const checkpoint = controller.checkpoint();
  assert.equal(checkpoint.cycleHistory?.length, 1);
  assert.equal(checkpoint.cycleHistory?.[0]?.finishedAt, latest.finishedAt);
  assert.equal(checkpoint.lastCycle?.finishedAt, latest.finishedAt);
});

test('restore caps durable operator history to the latest 96 cycles', () => {
  const controller = new PaperLoopController();
  const cycleHistory = Array.from({ length: 120 }, (_, index) => makeCycle(index + 1));

  controller.restore({
    schemaVersion: 1,
    running: false,
    config,
    cycleCount: 120,
    lastCycle: cycleHistory[cycleHistory.length - 1],
    marketHistory: [],
    cycleHistory,
  });

  const checkpoint = controller.checkpoint();
  assert.equal(checkpoint.cycleHistory?.length, 96);
  assert.equal(checkpoint.cycleHistory?.[0]?.finishedAt, makeCycle(25).finishedAt);
  assert.equal(checkpoint.cycleHistory?.[95]?.finishedAt, makeCycle(120).finishedAt);
});

test('checkpoint cloning prevents caller mutation from corrupting retained history', () => {
  const controller = new PaperLoopController();
  const latest = makeCycle(3);

  controller.restore({
    schemaVersion: 1,
    running: false,
    config,
    cycleCount: 3,
    lastCycle: latest,
    marketHistory: [],
    cycleHistory: [latest],
  });

  const exported = controller.checkpoint();
  if (!exported.cycleHistory) throw new Error('Expected cycle history.');
  exported.cycleHistory[0].scanned = 999;

  const second = controller.checkpoint();
  assert.equal(second.cycleHistory?.[0]?.scanned, 6);
});
