import assert from 'node:assert/strict';
import test from 'node:test';
import { paperLoopController } from './paperLoop';
import { paperTradingSession } from './paperSession';
import { tradingRuntimeProfile } from './runtimeProfile';
import { buildRuntimeCheckpoint, restoreRuntimeCheckpointValue } from './runtimeState';

test('runtime checkpoint preimage restores execution and loop state after a failed cycle commit', () => {
  paperTradingSession.reset(tradingRuntimeProfile.initialEquityKrw);
  paperLoopController.restore({
    schemaVersion: 1,
    running: false,
    config: {
      intervalMs: 900_000,
      maxMarkets: 6,
      maxOpenPositions: 4,
    },
    cycleCount: 12,
    lastCycle: null,
  }, false);

  const preimage = buildRuntimeCheckpoint('atomicity-test-preimage');

  paperTradingSession.reset(tradingRuntimeProfile.initialEquityKrw - 1_000_000);
  paperLoopController.restore({
    schemaVersion: 1,
    running: false,
    config: {
      intervalMs: 600_000,
      maxMarkets: 2,
      maxOpenPositions: 1,
    },
    cycleCount: 99,
    lastCycle: null,
  }, false);

  assert.equal(paperTradingSession.state().portfolio.initialEquity, tradingRuntimeProfile.initialEquityKrw - 1_000_000);
  assert.equal(paperLoopController.checkpoint().cycleCount, 99);

  const restored = restoreRuntimeCheckpointValue(preimage, false);
  const session = paperTradingSession.state();
  const loop = paperLoopController.checkpoint();

  assert.equal(restored.restored, true);
  assert.equal(restored.reason, 'atomicity-test-preimage');
  assert.equal(session.portfolio.initialEquity, tradingRuntimeProfile.initialEquityKrw);
  assert.equal(session.portfolio.cash, tradingRuntimeProfile.initialEquityKrw);
  assert.equal(loop.cycleCount, 12);
  assert.equal(loop.config.intervalMs, 900_000);
  assert.equal(loop.config.maxMarkets, 6);
  assert.equal(loop.config.maxOpenPositions, 4);
  assert.equal(loop.running, false);
});
