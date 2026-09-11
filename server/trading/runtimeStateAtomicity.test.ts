import assert from 'node:assert/strict';
import test from 'node:test';
import { TRADING_STRATEGY_VERSION } from '../../src/trading/config';
import { paperLoopController } from './paperLoop';
import { paperTradingSession } from './paperSession';
import { PAPER_CHECKPOINT_LEDGER_LIMIT } from './checkpointPolicy';
import { tradingRuntimeProfile } from './runtimeProfile';
import { buildRuntimePreimage, restoreRuntimePreimage } from './runtimeState';

test('S1R2 runtime preimage rollback preserves exact state without checkpoint compaction', () => {
  paperTradingSession.reset(tradingRuntimeProfile.initialEquityKrw);
  const seededSession = paperTradingSession.checkpoint();
  const ledgerLength = PAPER_CHECKPOINT_LEDGER_LIMIT + 200;
  seededSession.ledger = Array.from({ length: ledgerLength }, (_, index) => ({
    id: `s1r2-atomicity-${index + 1}`,
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
    config: { intervalMs: 900_000, maxMarkets: 6, maxOpenPositions: 4 },
    cycleCount: 12,
    lastCycle: null,
  }, false);

  const preimage = buildRuntimePreimage('s1r2-atomicity-preimage');
  assert.equal(preimage.session.ledger.length, ledgerLength);

  paperTradingSession.reset(tradingRuntimeProfile.initialEquityKrw - 1_000_000);
  paperLoopController.restore({
    schemaVersion: 1,
    running: false,
    config: { intervalMs: 600_000, maxMarkets: 2, maxOpenPositions: 1 },
    cycleCount: 99,
    lastCycle: null,
  }, false);

  const restored = restoreRuntimePreimage(preimage, false);
  const session = paperTradingSession.state();
  const loop = paperLoopController.checkpoint();

  assert.equal(restored.restored, true);
  assert.equal(restored.reason, 's1r2-atomicity-preimage');
  assert.equal(session.portfolio.initialEquity, tradingRuntimeProfile.initialEquityKrw);
  assert.equal(session.ledger.length, ledgerLength);
  assert.equal((session.ledger[0] as any).id, 's1r2-atomicity-1');
  assert.equal((session.ledger.at(-1) as any).id, `s1r2-atomicity-${ledgerLength}`);
  assert.equal(loop.cycleCount, 12);
  assert.equal(loop.config.intervalMs, 900_000);
  assert.equal(loop.config.maxMarkets, 6);
  assert.equal(loop.config.maxOpenPositions, 4);
  assert.equal(loop.running, false);
});
