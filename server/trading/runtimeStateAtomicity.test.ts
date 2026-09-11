import assert from 'node:assert/strict';
import test from 'node:test';
import { TRADING_STRATEGY_VERSION } from '../../src/trading/config';
import { paperLoopController } from './paperLoop';
import { paperTradingSession } from './paperSession';
import { tradingRuntimeProfile } from './runtimeProfile';
import { buildRuntimePreimage, restoreRuntimePreimage } from './runtimeState';

test('runtime preimage restores exact execution, loop, and ledger state after a failed cycle commit', () => {
  paperTradingSession.reset(tradingRuntimeProfile.initialEquityKrw);
  const seededSession = paperTradingSession.checkpoint();
  seededSession.ledger = Array.from({ length: 550 }, (_, index) => ({
    id: `atomicity-ledger-${index + 1}`,
    sequence: index + 1,
    timestamp: index + 1,
    type: 'SIGNAL',
    strategyVersion: TRADING_STRATEGY_VERSION,
    payload: { index },
  } as any));
  paperTradingSession.restore(seededSession);

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

  const preimage = buildRuntimePreimage('atomicity-test-preimage');
  assert.equal(preimage.session.ledger.length, 550);

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

  const restored = restoreRuntimePreimage(preimage, false);
  const session = paperTradingSession.state();
  const loop = paperLoopController.checkpoint();

  assert.equal(restored.restored, true);
  assert.equal(restored.reason, 'atomicity-test-preimage');
  assert.equal(session.portfolio.initialEquity, tradingRuntimeProfile.initialEquityKrw);
  assert.equal(session.portfolio.cash, tradingRuntimeProfile.initialEquityKrw);
  assert.equal(session.ledger.length, 550);
  assert.equal((session.ledger[0] as any).id, 'atomicity-ledger-1');
  assert.equal((session.ledger[0] as any).sequence, 1);
  assert.equal((session.ledger.at(-1) as any).id, 'atomicity-ledger-550');
  assert.equal((session.ledger.at(-1) as any).sequence, 550);
  assert.equal(loop.cycleCount, 12);
  assert.equal(loop.config.intervalMs, 900_000);
  assert.equal(loop.config.maxMarkets, 6);
  assert.equal(loop.config.maxOpenPositions, 4);
  assert.equal(loop.running, false);
});
