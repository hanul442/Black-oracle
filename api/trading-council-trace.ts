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
        error: 'Council trace requires Supabase persistence in this deployment.',
      });
    }

    const [{ tradingCheckpointStore }, { summarizeCouncilComparison }] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../src/trading/councilComparison.js'),
    ]);

    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) {
      return response.status(200).json({
        success: true,
        available: false,
        traces: [],
        comparison: summarizeCouncilComparison([]),
      });
    }

    const now = Date.now();
    const comparisons = Array.isArray(checkpoint.loop.councilComparisons) ? checkpoint.loop.councilComparisons : [];
    const lastCycleMarkets = Array.isArray(checkpoint.loop.lastCycle?.markets) ? checkpoint.loop.lastCycle.markets : [];
    const latestByMarket = new Map<string, any>();

    for (const item of comparisons) {
      const market = String(item?.market ?? '').toUpperCase();
      if (!market) continue;
      const current = latestByMarket.get(market);
      if (!current || Number(item.generatedAt ?? 0) > Number(current.generatedAt ?? 0)) latestByMarket.set(market, item);
    }

    const decisionByMarket = new Map(lastCycleMarkets.map((item: any) => [String(item.market).toUpperCase(), item]));
    const activeEvidence = Array.isArray(checkpoint.evidence)
      ? checkpoint.evidence.filter((item: any) => Number(item?.expiresAt ?? 0) > now)
      : [];
    const markets = Array.from(new Set([
      ...lastCycleMarkets.map((item: any) => String(item.market).toUpperCase()),
      ...latestByMarket.keys(),
    ])).filter(Boolean);

    const traces = markets.map((market) => {
      const comparison = latestByMarket.get(market) ?? null;
      const decision: any = decisionByMarket.get(market) ?? null;
      const evidenceItems = activeEvidence
        .filter((item: any) => String(item.market).toUpperCase() === market)
        .sort((a: any, b: any) => Number(b.observedAt ?? 0) - Number(a.observedAt ?? 0) || Number(b.reliability ?? 0) - Number(a.reliability ?? 0))
        .slice(0, 12)
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          direction: item.direction,
          strength: item.strength,
          reliability: item.reliability,
          sourceType: item.sourceType,
          publisher: item.publisher ?? item.source ?? 'Unknown source',
          sourceUrl: item.sourceUrl ?? null,
          summary: item.summary ?? null,
          observedAt: item.observedAt,
          expiresAt: item.expiresAt,
          contradictionOf: item.contradictionOf ?? null,
        }));
      const contradictionCount = evidenceItems.filter((item: any) => Boolean(item.contradictionOf)).length;

      return {
        market,
        generatedAt: comparison?.generatedAt ?? decision?.timestamp ?? null,
        anchorPrice: comparison?.anchorPrice ?? null,
        targetTimestamp: comparison?.targetTimestamp ?? null,
        resolvedAt: comparison?.resolvedAt ?? null,
        targetPrice: comparison?.targetPrice ?? null,
        rawReturn: comparison?.rawReturn ?? null,
        v1DirectionalUtility: comparison?.v1DirectionalUtility ?? null,
        v2DirectionalUtility: comparison?.v2DirectionalUtility ?? null,
        v1Favorable: comparison?.v1Favorable ?? null,
        v2Favorable: comparison?.v2Favorable ?? null,
        v1: comparison?.v1 ?? null,
        v2: comparison?.v2 ?? null,
        trace: comparison?.trace ?? null,
        decision: decision ? {
          action: decision.decision ?? decision.action ?? null,
          timestamp: decision.timestamp ?? null,
          regime: decision.regime ?? null,
          oracleTradeScore: decision.oracleTradeScore ?? null,
          confidence: decision.confidence ?? null,
          strategyDisposition: decision.strategyDisposition ?? null,
          riskDisposition: decision.riskDisposition ?? null,
          evidenceActiveCount: decision.evidenceActiveCount ?? 0,
          evidenceContradictionCount: decision.evidenceContradictionCount ?? 0,
          primaryReason: decision.primaryReason ?? null,
          reasons: Array.isArray(decision.reasons) ? decision.reasons : [],
          riskReasons: Array.isArray(decision.riskReasons) ? decision.riskReasons : [],
          governance: decision.governance ?? null,
        } : null,
        evidence: {
          activeCount: evidenceItems.length,
          contradictionCount,
          items: evidenceItems,
        },
        executionAuthority: false,
        promotionAuthority: false,
      };
    }).sort((a, b) => Number(b.generatedAt ?? 0) - Number(a.generatedAt ?? 0) || a.market.localeCompare(b.market));

    return response.status(200).json({
      success: true,
      available: true,
      now,
      mode: 'PAPER',
      traces,
      comparison: summarizeCouncilComparison(comparisons),
      executionAuthority: false,
      promotionAuthority: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Council trace error.';
    console.error('Black Oracle Council trace error:', error);
    return response.status(500).json({ success: false, available: false, error: message });
  }
}
