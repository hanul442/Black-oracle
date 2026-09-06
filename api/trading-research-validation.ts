export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
      return response.status(503).json({ success: false, available: false, error: 'Research validation requires Supabase persistence in this deployment.' });
    }

    const [
      { tradingCheckpointStore },
      {
        buildExpectedShortfall,
        buildDeflatedSharpe,
        buildProbabilityBacktestOverfitting,
        buildCalibration,
        buildBlockRegimeMonteCarlo,
      },
      { summarizeCouncilComparison },
    ] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../src/trading/researchValidation.js'),
      import('../src/trading/councilComparison.js'),
    ]);

    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) return response.status(200).json({ success: true, available: false, now: Date.now() });

    const closedReturns = checkpoint.session.closedTrades.map((trade) => trade.returnPct);
    const configuredTrialCount = Number(process.env.TRADING_RESEARCH_TRIAL_COUNT ?? '');
    const trialCount = Number.isInteger(configuredTrialCount) && configuredTrialCount > 0 ? configuredTrialCount : 1;
    const trialCountSource = trialCount > 1 ? 'ENV_CONFIGURED' : 'UNSPECIFIED_DEFAULT_1';
    const validationSamples = Array.isArray(checkpoint.loop.validationSamples) ? checkpoint.loop.validationSamples : [];
    const blockSamples = validationSamples.map((item) => ({ returnPct: item.directionalReturn, regime: item.regime || 'UNKNOWN' }));
    const comparisons = Array.isArray(checkpoint.loop.councilComparisons) ? checkpoint.loop.councilComparisons : [];
    const resolvedComparisons = comparisons.filter((item) => item.resolvedAt != null && item.v1Favorable != null && item.v2Favorable != null);
    const v1Calibration = buildCalibration(resolvedComparisons.map((item) => ({
      probability: item.v1.probability * 0.7 + item.v1.confidence * 0.3,
      outcome: Boolean(item.v1Favorable),
    })));
    const v2Calibration = buildCalibration(resolvedComparisons.map((item) => ({
      probability: item.v2.probability * 0.7 + item.v2.confidence * 0.3,
      outcome: Boolean(item.v2Favorable),
    })));

    return response.status(200).json({
      success: true,
      available: true,
      now: Date.now(),
      sampleBasis: {
        closedTrades: closedReturns.length,
        blindValidationSamples: validationSamples.length,
        councilComparisonSamples: comparisons.length,
        resolvedCouncilComparisons: resolvedComparisons.length,
      },
      expectedShortfall: {
        es95: buildExpectedShortfall(closedReturns, 0.95),
        es99: buildExpectedShortfall(closedReturns, 0.99),
      },
      deflatedSharpe: {
        ...buildDeflatedSharpe(closedReturns, trialCount),
        trialCountSource,
      },
      probabilityBacktestOverfitting: {
        ...buildProbabilityBacktestOverfitting([]),
        source: 'STRATEGY_RETURN_PANEL_NOT_PERSISTED',
        note: 'PBO remains unavailable until aligned return panels for multiple Strategy Factory candidates are persisted. A single strategy history is not sufficient.',
      },
      blockRegimeMonteCarlo: {
        ...buildBlockRegimeMonteCarlo(blockSamples),
        sampleBasis: 'BLIND_VALIDATION_DIRECTIONAL_RETURNS',
      },
      councilComparison: summarizeCouncilComparison(comparisons),
      forecastCalibration: {
        v1: v1Calibration,
        v2: v2Calibration,
        sampleBasis: 'RESOLVED_COUNCIL_COMPARISON_TOP_SCENARIO',
      },
      executionAuthority: false,
      promotionAuthority: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown research validation error.';
    console.error('Black Oracle research validation error:', error);
    return response.status(500).json({ success: false, available: false, error: message });
  }
}
