export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
      return response.status(503).json({
        success: false,
        available: false,
        status: 'UNAVAILABLE',
        error: 'Trading status requires Supabase persistence in this deployment.',
      });
    }

    const [{ tradingCheckpointStore }, { buildPaperPerformance }] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../src/trading/performance.js'),
    ]);

    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) {
      return response.status(200).json({
        success: true,
        available: false,
        status: 'WAITING',
        now: Date.now(),
        message: 'No Paper checkpoint has been saved yet.',
      });
    }

    const now = Date.now();
    const portfolio = checkpoint.session.portfolio;
    const lastCurvePoint = portfolio.equityCurve.length
      ? portfolio.equityCurve[portfolio.equityCurve.length - 1]
      : null;
    const equity = lastCurvePoint?.equity ?? portfolio.initialEquity;
    const currentDrawdownPct = portfolio.peakEquity > 0
      ? Math.max(0, (portfolio.peakEquity - equity) / portfolio.peakEquity)
      : 0;
    const dailyPnlPct = portfolio.dailyStartEquity > 0
      ? (equity - portfolio.dailyStartEquity) / portfolio.dailyStartEquity
      : 0;

    const performance = buildPaperPerformance(
      checkpoint.session.closedTrades,
      portfolio.equityCurve,
      portfolio.initialEquity,
      equity,
      currentDrawdownPct,
    );

    const lastCycle = checkpoint.loop.lastCycle;
    const cycleAgeMs = lastCycle ? Math.max(0, now - lastCycle.finishedAt) : null;
    const staleThresholdMs = checkpoint.loop.config.intervalMs * 2.5;
    const stale = cycleAgeMs !== null ? cycleAgeMs > staleThresholdMs : true;
    const cycleErrors = lastCycle?.errors.length ?? 0;
    const status = !lastCycle ? 'WAITING' : stale || cycleErrors > 0 ? 'DEGRADED' : 'OK';

    const activeEvidence = checkpoint.evidence.filter((item) => item.expiresAt > now);
    const expiredEvidence = checkpoint.evidence.length - activeEvidence.length;

    const decisionTape = (lastCycle?.markets ?? []).map((item) => ({
      timestamp: lastCycle?.finishedAt ?? checkpoint.savedAt,
      market: item.market,
      decision: item.decision,
      oracleTradeScore: item.oracleTradeScore,
      eventScore: item.eventScore,
    }));

    const recentTrades = checkpoint.session.closedTrades.slice(-20).reverse().map((trade) => ({
      id: trade.id,
      market: trade.market,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      netPnl: trade.netPnl,
      returnPct: trade.returnPct,
      fees: trade.fees,
      exitReason: trade.exitReason,
      strategyVersion: trade.strategyVersion,
      entryOracleTradeScore: trade.entryOracleTradeScore,
      exitOracleTradeScore: trade.exitOracleTradeScore,
    }));
    const lastClosedTrade = checkpoint.session.closedTrades.length
      ? checkpoint.session.closedTrades[checkpoint.session.closedTrades.length - 1]
      : null;

    return response.status(200).json({
      success: true,
      available: true,
      status,
      now,
      mode: 'PAPER',
      strategyVersion: lastClosedTrade?.strategyVersion ?? null,
      checkpoint: {
        savedAt: checkpoint.savedAt,
        reason: checkpoint.reason,
        runtimeId: process.env.TRADING_RUNTIME_ID || 'black-oracle-paper',
        backend: 'supabase',
      },
      loop: {
        cycleCount: checkpoint.loop.cycleCount,
        intervalMs: checkpoint.loop.config.intervalMs,
        maxMarkets: checkpoint.loop.config.maxMarkets,
        maxOpenPositions: checkpoint.loop.config.maxOpenPositions,
        lastCycle: lastCycle ? {
          startedAt: lastCycle.startedAt,
          finishedAt: lastCycle.finishedAt,
          durationMs: Math.max(0, lastCycle.finishedAt - lastCycle.startedAt),
          scanned: lastCycle.scanned,
          entered: lastCycle.entered,
          exited: lastCycle.exited,
          held: lastCycle.held,
          errors: lastCycle.errors,
        } : null,
        ageMs: cycleAgeMs,
        stale,
      },
      portfolio: {
        initialEquity: portfolio.initialEquity,
        equity,
        cash: portfolio.cash,
        realizedPnl: portfolio.realizedPnl,
        feesPaid: portfolio.feesPaid,
        dailyPnlPct,
        currentDrawdownPct,
        openPositions: portfolio.positions,
      },
      performance,
      ingestion: {
        markedMarkets: checkpoint.session.markPrices.length,
        evidenceTotal: checkpoint.evidence.length,
        evidenceActive: activeEvidence.length,
        evidenceExpired: expiredEvidence,
        scannedMarketsLastCycle: lastCycle?.scanned ?? 0,
        lastCycleErrors: cycleErrors,
      },
      equityCurve: portfolio.equityCurve.slice(-120),
      decisionTape,
      recentTrades,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown trading status error.';
    console.error('Black Oracle trading status error:', error);
    return response.status(500).json({ success: false, available: false, status: 'ERROR', error: message });
  }
}
