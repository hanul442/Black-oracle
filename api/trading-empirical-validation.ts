export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
      return response.status(503).json({ success: false, available: false, error: 'Empirical PAPER validation requires Supabase persistence in this deployment.' });
    }

    const [
      { tradingCheckpointStore },
      { buildEmpiricalAccumulationHealth, buildDailyEmpiricalPaperReport, scopeEmpiricalInputToQualificationWindow },
      { normalizeQualificationWindow, qualificationWindowSummary },
      { normalizeStrategyReturnPanel, summarizeStrategyReturnPanel },
    ] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../src/trading/empiricalValidation.js'),
      import('../src/trading/qualificationWindow.js'),
      import('../src/trading/strategyReturnPanel.js'),
    ]);

    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) {
      return response.status(200).json({ success: true, available: false, now: Date.now(), executionAuthority: false, promotionAuthority: false });
    }

    const now = Date.now();
    const cycleHistory = Array.isArray(checkpoint.loop.cycleHistory)
      ? checkpoint.loop.cycleHistory
      : checkpoint.loop.lastCycle
        ? [checkpoint.loop.lastCycle]
        : [];
    const validationSamples = Array.isArray(checkpoint.loop.validationSamples) ? checkpoint.loop.validationSamples : [];
    const councilComparisons = Array.isArray(checkpoint.loop.councilComparisons) ? checkpoint.loop.councilComparisons : [];
    const strategyPanel = normalizeStrategyReturnPanel(checkpoint.loop.strategyReturnPanel);
    const strategySummary = summarizeStrategyReturnPanel(strategyPanel);
    const experimentEvents = Array.isArray(checkpoint.experimentLedger) ? checkpoint.experimentLedger : [];
    const gradeHistory = Array.isArray(checkpoint.gradeSurveillance?.history) ? checkpoint.gradeSurveillance.history : [];
    const closedTrades = Array.isArray(checkpoint.session.closedTrades) ? checkpoint.session.closedTrades : [];

    const empiricalInput = {
      now,
      intervalMs: checkpoint.loop.config?.intervalMs ?? 15 * 60_000,
      cycleHistory,
      validationSamples,
      councilComparisons,
      strategyObservations: strategyPanel.observations,
      strategyAlignedObservations: strategySummary.alignedObservations,
      minimumPboObservations: strategySummary.minimumPboObservations,
      experimentEvents,
      gradeHistory,
      closedTrades,
      timezoneOffsetMinutes: 540,
    };
    const qualificationWindow = normalizeQualificationWindow(checkpoint.qualificationWindow);
    const windowSummary = qualificationWindowSummary(qualificationWindow);
    const qualificationStartedAt = qualificationWindow?.status === 'COLLECTING' ? qualificationWindow.startedAt : null;
    const qualifiedInput = scopeEmpiricalInputToQualificationWindow(empiricalInput, qualificationStartedAt);

    return response.status(200).json({
      success: true,
      available: true,
      now,
      accumulation: buildEmpiricalAccumulationHealth(empiricalInput),
      daily: buildDailyEmpiricalPaperReport(empiricalInput),
      qualification: {
        window: windowSummary,
        creditActive: qualificationStartedAt != null,
        accumulation: buildEmpiricalAccumulationHealth(qualifiedInput),
        daily: buildDailyEmpiricalPaperReport(qualifiedInput),
        legacyCreditAllowed: false,
      },
      sourceCheckpoint: { savedAt: checkpoint.savedAt, reason: checkpoint.reason },
      executionAuthority: false,
      promotionAuthority: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown empirical PAPER validation error.';
    console.error('Black Oracle empirical PAPER validation error:', error);
    return response.status(500).json({ success: false, available: false, error: message, executionAuthority: false, promotionAuthority: false });
  }
}
