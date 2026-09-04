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

    const [
      { tradingCheckpointStore },
      { buildPaperPerformance },
      { buildRiskProfileComparison },
      { assessPortfolioExposure },
    ] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../src/trading/performance.js'),
      import('../src/trading/riskProfiles.js'),
      import('../src/trading/portfolioExposure.js'),
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

    const positionReturns = checkpoint.session.closedTrades.map((trade) => trade.returnPct);
    const riskLab = buildRiskProfileComparison(positionReturns);
    // Backward-compatible validation field now uses the Conservative account-impact normalized profile.
    // This fixes the prior unit mismatch where position return was treated as whole-account return.
    const validation = riskLab[0].validation;

    const lastCycle = checkpoint.loop.lastCycle;
    const cycleAgeMs = lastCycle ? Math.max(0, now - lastCycle.finishedAt) : null;
    const staleThresholdMs = checkpoint.loop.config.intervalMs * 2.5;
    const stale = cycleAgeMs !== null ? cycleAgeMs > staleThresholdMs : true;
    const cycleErrors = lastCycle?.errors.length ?? 0;
    const status = !lastCycle ? 'WAITING' : stale || cycleErrors > 0 ? 'DEGRADED' : 'OK';

    const activeEvidence = checkpoint.evidence.filter((item) => item.expiresAt > now);
    const expiredEvidence = checkpoint.evidence.length - activeEvidence.length;

    const decisionTape = (lastCycle?.markets ?? []).map((item) => ({
      timestamp: item.timestamp ?? lastCycle?.finishedAt ?? checkpoint.savedAt,
      market: item.market,
      decision: item.decision,
      regime: item.regime ?? null,
      regimeConfidence: item.regimeConfidence ?? null,
      oracleTradeScore: item.oracleTradeScore,
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

    const decisionByMarket = new Map(decisionTape.map((item) => [item.market, item]));
    const markPriceByMarket = new Map(checkpoint.session.markPrices ?? []);
    const positionEvidence = portfolio.positions.map((position) => {
      const decision = decisionByMarket.get(position.market);
      const markPrice = Number(markPriceByMarket.get(position.market) ?? position.entryPrice);
      const marketValue = markPrice * position.quantity;
      const costBasis = position.averageCost * position.quantity;
      const externalEvidenceActive = decision?.evidenceActiveCount ?? 0;
      const externalEvidenceContradictions = decision?.evidenceContradictionCount ?? 0;
      const evidenceState = stale
        ? 'STALE'
        : externalEvidenceContradictions > 0
          ? 'CONTESTED'
          : externalEvidenceActive > 0
            ? 'EVIDENCE_SUPPORTED'
            : 'TECHNICAL_ONLY';

      return {
        market: position.market,
        openedAt: position.openedAt,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        averageCost: position.averageCost,
        markPrice,
        marketValue,
        unrealizedPnl: marketValue - costBasis,
        stopLossPrice: position.stopLossPrice,
        takeProfitPrice: position.takeProfitPrice,
        evidenceState,
        lastDecisionAt: decision?.timestamp ?? null,
        decision: decision?.decision ?? null,
        regime: decision?.regime ?? null,
        regimeConfidence: decision?.regimeConfidence ?? null,
        router: decision?.strategyDisposition ?? null,
        confidence: decision?.confidence ?? null,
        oracleTradeScore: decision?.oracleTradeScore ?? null,
        riskDisposition: decision?.riskDisposition ?? 'NOT_EVALUATED',
        externalEvidenceActive,
        externalEvidenceContradictions,
        evidenceIds: decision?.evidenceIds ?? [],
        forecast: decision?.forecast ?? null,
        primaryReason: decision?.primaryReason ?? 'No persisted decision explanation is available for this position.',
      };
    });

    const exposurePositions = positionEvidence.map((position) => ({
      market: position.market,
      marketValue: position.marketValue,
    }));
    const exposureLab = riskLab.map((item) => ({
      profileId: item.profile.id,
      profileLabel: item.profile.label,
      assessment: assessPortfolioExposure(
        equity,
        exposurePositions,
        {
          grossExposureCapPct: item.profile.grossExposureCapPct,
          cryptoClusterExposureCapPct: item.profile.cryptoClusterExposureCapPct,
        },
        [],
      ),
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
          noTrade: lastCycle.noTrade ?? 0,
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
      validation,
      riskLab,
      exposureLab,
      ingestion: {
        markedMarkets: checkpoint.session.markPrices.length,
        evidenceTotal: checkpoint.evidence.length,
        evidenceActive: activeEvidence.length,
        evidenceExpired: expiredEvidence,
        scannedMarketsLastCycle: lastCycle?.scanned ?? 0,
        lastCycleErrors: cycleErrors,
      },
      positionEvidence,
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
