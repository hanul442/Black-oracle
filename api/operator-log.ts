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
        error: 'Operator log requires Supabase persistence in this deployment.',
      });
    }

    const { tradingCheckpointStore } = await import('../server/trading/persistence.js');
    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) {
      return response.status(200).json({
        success: true,
        available: false,
        cycles: [],
        decisions: [],
        errors: [],
        message: 'No Paper checkpoint has been saved yet.',
      });
    }

    const rawLimit = Number(request.query?.limit ?? 48);
    const limit = Number.isInteger(rawLimit) ? Math.min(96, Math.max(1, rawLimit)) : 48;
    const storedHistory = Array.isArray(checkpoint.loop.cycleHistory)
      ? checkpoint.loop.cycleHistory
      : [];
    const history = storedHistory.length
      ? storedHistory.slice(-limit)
      : checkpoint.loop.lastCycle
        ? [checkpoint.loop.lastCycle]
        : [];
    const firstCycleNumber = Math.max(1, checkpoint.loop.cycleCount - history.length + 1);

    const cycles = history.map((cycle, index) => ({
      cycleNumber: firstCycleNumber + index,
      startedAt: cycle.startedAt,
      finishedAt: cycle.finishedAt,
      durationMs: Math.max(0, cycle.finishedAt - cycle.startedAt),
      scanned: cycle.scanned,
      entered: cycle.entered,
      exited: cycle.exited,
      held: cycle.held,
      noTrade: cycle.noTrade ?? 0,
      errorCount: cycle.errors.length,
    }));

    const decisions = history.flatMap((cycle, index) => {
      const cycleNumber = firstCycleNumber + index;
      return cycle.markets.map((item) => ({
        cycleNumber,
        cycleFinishedAt: cycle.finishedAt,
        timestamp: item.timestamp ?? cycle.finishedAt,
        market: item.market,
        decision: item.decision,
        regime: item.regime ?? null,
        regimeConfidence: item.regimeConfidence ?? null,
        oracleTradeScore: item.oracleTradeScore ?? null,
        confidence: item.confidence ?? null,
        strategyDisposition: item.strategyDisposition ?? null,
        riskDisposition: item.riskDisposition ?? 'NOT_EVALUATED',
        eventScore: item.eventScore ?? null,
        forecast: item.forecast ?? null,
        evidenceActiveCount: item.evidenceActiveCount ?? 0,
        evidenceContradictionCount: item.evidenceContradictionCount ?? 0,
        evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : [],
        primaryReason: item.primaryReason ?? null,
        reasons: Array.isArray(item.reasons) ? item.reasons : [],
        riskReasons: Array.isArray(item.riskReasons) ? item.riskReasons : [],
      }));
    });

    const errors = history.flatMap((cycle, index) => {
      const cycleNumber = firstCycleNumber + index;
      return cycle.errors.map((item) => ({
        cycleNumber,
        timestamp: cycle.finishedAt,
        market: item.market,
        error: item.error,
      }));
    });

    return response.status(200).json({
      success: true,
      available: true,
      now: Date.now(),
      runtimeId: process.env.TRADING_RUNTIME_ID || 'black-oracle-paper',
      checkpointSavedAt: checkpoint.savedAt,
      cycleCount: checkpoint.loop.cycleCount,
      retainedCycles: history.length,
      historyAvailable: storedHistory.length > 1,
      cycles: cycles.slice().reverse(),
      decisions: decisions.slice(-600).reverse(),
      errors: errors.slice(-200).reverse(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown operator log error.';
    console.error('Black Oracle operator log error:', error);
    return response.status(500).json({ success: false, available: false, error: message });
  }
}
