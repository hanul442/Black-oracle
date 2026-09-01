import { DEFAULT_RISK_LIMITS, TRADING_STRATEGY_VERSION } from '../../src/trading/config';
import { paperLoopController } from './paperLoop';
import { paperTradingSession } from './paperSession';
import { runtimePersistenceStatus } from './runtimeState';

const bootedAt = Date.now();

export const buildRuntimeHealth = () => {
  const now = Date.now();
  const loop = paperLoopController.status();
  const session = paperTradingSession.state();
  const persistence = runtimePersistenceStatus();
  const lastCycleFinishedAt = loop.lastCycle?.finishedAt ?? null;
  const loopStale = Boolean(
    loop.running &&
    loop.cycleCount > 0 &&
    lastCycleFinishedAt &&
    now - lastCycleFinishedAt > loop.config.intervalMs * 2.5,
  );
  const lastCycleErrors = loop.lastCycle?.errors.length ?? 0;
  const persistenceFault = Boolean(persistence.lastError) || !persistence.configured;
  const riskLocked =
    session.portfolio.dailyPnlPct <= -DEFAULT_RISK_LIMITS.maxDailyLossPct ||
    session.portfolio.drawdownPct >= DEFAULT_RISK_LIMITS.maxTotalDrawdownPct;
  const healthy = !loopStale && !persistenceFault;

  return {
    success: healthy,
    status: healthy ? 'OK' as const : 'DEGRADED' as const,
    service: 'black-oracle-trading-gateway',
    strategyVersion: TRADING_STRATEGY_VERSION,
    mode: 'PAPER' as const,
    now,
    uptimeMs: now - bootedAt,
    persistence: {
      ...persistence,
      fault: persistenceFault,
    },
    loop: {
      running: loop.running,
      cycleInProgress: loop.cycleInProgress,
      cycleCount: loop.cycleCount,
      intervalMs: loop.config.intervalMs,
      lastCycleFinishedAt,
      lastCycleErrors,
      stale: loopStale,
    },
    portfolio: {
      equity: session.portfolio.equity,
      cash: session.portfolio.cash,
      openPositions: session.portfolio.positions.length,
      dailyPnlPct: session.portfolio.dailyPnlPct,
      drawdownPct: session.portfolio.drawdownPct,
      riskLocked,
    },
    performance: {
      trades: session.performance.trades,
      winRate: session.performance.winRate,
      expectancy: session.performance.expectancy,
      profitFactor: session.performance.profitFactor,
      maxDrawdownPct: session.performance.maxDrawdownPct,
    },
  };
};
