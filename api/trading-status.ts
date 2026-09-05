export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
      return response.status(503).json({ success: false, available: false, status: 'UNAVAILABLE', error: 'Trading status requires Supabase persistence in this deployment.' });
    }

    const [
      { tradingCheckpointStore },
      { buildPaperPerformance },
      { buildRiskProfileComparison },
      { assessPortfolioExposure },
      { buildAlignedMarketReturnSeries },
      { runWalkForwardValidation },
      { summarizeValidationSamples },
      { assessAuditCompleteness },
      { assessLiveEligibility },
    ] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../src/trading/performance.js'),
      import('../src/trading/riskProfiles.js'),
      import('../src/trading/portfolioExposure.js'),
      import('../src/trading/marketHistory.js'),
      import('../src/trading/blindValidation.js'),
      import('../src/trading/validationLedger.js'),
      import('../src/trading/auditCompleteness.js'),
      import('../src/trading/liveEligibility.js'),
    ]);

    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) {
      return response.status(200).json({ success: true, available: false, status: 'WAITING', now: Date.now(), message: 'No Paper checkpoint has been saved yet.' });
    }

    const now = Date.now();
    const portfolio = checkpoint.session.portfolio;
    const lastCurvePoint = portfolio.equityCurve.length ? portfolio.equityCurve[portfolio.equityCurve.length - 1] : null;
    const equity = lastCurvePoint?.equity ?? portfolio.initialEquity;
    const currentDrawdownPct = portfolio.peakEquity > 0 ? Math.max(0, (portfolio.peakEquity - equity) / portfolio.peakEquity) : 0;
    const dailyPnlPct = portfolio.dailyStartEquity > 0 ? (equity - portfolio.dailyStartEquity) / portfolio.dailyStartEquity : 0;
    const performance = buildPaperPerformance(checkpoint.session.closedTrades, portfolio.equityCurve, portfolio.initialEquity, equity, currentDrawdownPct);

    const positionReturns = checkpoint.session.closedTrades.map((trade) => trade.returnPct);
    const riskLab = buildRiskProfileComparison(positionReturns);
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
      governance: item.governance ? {
        finalDecisionId: item.governance.finalDecisionId,
        baseAction: item.governance.baseAction,
        mode: item.governance.mode,
        policy: item.governance.policy,
        intelligenceDisposition: item.governance.intelligenceDisposition,
        intelligenceConfidence: item.governance.intelligenceConfidence,
        intelligencePackageId: item.governance.intelligencePackageId,
        scenarioSetId: item.governance.scenarioSetId,
        recommendedScenarioId: item.governance.recommendedScenarioId,
        councilRunId: item.governance.councilRunId,
      } : null,
    }));

    const decisionByMarket = new Map(decisionTape.map((item) => [item.market, item]));
    const markPriceByMarket = new Map(checkpoint.session.markPrices ?? []);
    const positionEvidence = portfolio.positions.map((position) => {
      const decision = decisionByMarket.get(position.market);
      const markPrice = Number(markPriceByMarket.get(position.market) ?? position.entryPrice);
      const marketValue = markPrice * position.quantity;
      const costBasis = position.averageCost * position.quantity;
      const evidenceItems = activeEvidence
        .filter((item) => item.market === position.market)
        .sort((a, b) => b.observedAt - a.observedAt || b.reliability - a.reliability)
        .slice(0, 8)
        .map((item) => ({
          id: item.id, title: item.title, direction: item.direction, strength: item.strength, reliability: item.reliability, sourceType: item.sourceType,
          publisher: item.publisher ?? item.source ?? 'Unknown source', sourceUrl: item.sourceUrl ?? null, summary: item.summary ?? null,
          observedAt: item.observedAt, expiresAt: item.expiresAt, contradictionOf: item.contradictionOf ?? null,
        }));
      const externalEvidenceActive = evidenceItems.length;
      const externalEvidenceContradictions = evidenceItems.filter((item) => Boolean(item.contradictionOf)).length;
      const evidenceState = stale ? 'STALE' : externalEvidenceContradictions > 0 ? 'CONTESTED' : externalEvidenceActive > 0 ? 'EVIDENCE_SUPPORTED' : 'TECHNICAL_ONLY';
      return {
        market: position.market, openedAt: position.openedAt, quantity: position.quantity, entryPrice: position.entryPrice, averageCost: position.averageCost,
        markPrice, marketValue, unrealizedPnl: marketValue - costBasis, stopLossPrice: position.stopLossPrice, takeProfitPrice: position.takeProfitPrice,
        evidenceState, lastDecisionAt: decision?.timestamp ?? null, decision: decision?.decision ?? null, regime: decision?.regime ?? null,
        regimeConfidence: decision?.regimeConfidence ?? null, router: decision?.strategyDisposition ?? null, confidence: decision?.confidence ?? null,
        oracleTradeScore: decision?.oracleTradeScore ?? null, riskDisposition: decision?.riskDisposition ?? 'NOT_EVALUATED', externalEvidenceActive,
        externalEvidenceContradictions, evidenceIds: evidenceItems.map((item) => item.id), decisionEvidenceIds: decision?.evidenceIds ?? [], evidenceItems,
        forecast: decision?.forecast ?? null, governance: decision?.governance ?? null,
        primaryReason: decision?.primaryReason ?? 'No persisted decision explanation is available for this position.',
      };
    });

    const exposurePositions = positionEvidence.map((position) => ({ market: position.market, marketValue: position.marketValue }));
    const correlationSeries = buildAlignedMarketReturnSeries(checkpoint.loop.marketHistory ?? [], exposurePositions.map((position) => position.market), 192);
    const correlationObservationCount = correlationSeries.length ? Math.min(...correlationSeries.map((item) => item.returns.length)) : 0;
    const exposureLab = riskLab.map((item) => ({
      profileId: item.profile.id,
      profileLabel: item.profile.label,
      assessment: assessPortfolioExposure(equity, exposurePositions, { grossExposureCapPct: item.profile.grossExposureCapPct, cryptoClusterExposureCapPct: item.profile.cryptoClusterExposureCapPct }, correlationSeries),
    }));

    const tradeCases = Array.isArray(checkpoint.tradeCases) ? checkpoint.tradeCases : [];
    const actualEntryExecutions = checkpoint.session.closedTrades.length + portfolio.positions.length;
    const linkedEntryCases = tradeCases.length;
    const legacyUnlinkedEntries = Math.max(0, actualEntryExecutions - linkedEntryCases);
    const evidenceLinkedEntries = tradeCases.filter((item) => item.entry?.decision?.evidenceActiveCount > 0 && Array.isArray(item.entry?.decision?.evidenceIds) && item.entry.decision.evidenceIds.length > 0).length;
    const evidenceLessEntries = legacyUnlinkedEntries + tradeCases.filter((item) => !(item.entry?.decision?.evidenceActiveCount > 0 && item.entry?.decision?.evidenceIds?.length)).length;
    const evidenceCoverage = actualEntryExecutions > 0 ? evidenceLinkedEntries / actualEntryExecutions : 0;

    const executionAuditScores: number[] = [];
    for (const item of tradeCases) {
      const entryAudit = assessAuditCompleteness({
        action: item.entry.decision.action,
        timestamp: item.entry.timestamp,
        market: item.market,
        regime: item.entry.decision.regime,
        oracleTradeScore: item.entry.multiTimeframe.oracleTradeScore,
        confidence: item.entry.multiTimeframe.confidence,
        strategyDisposition: item.entry.decision.route,
        riskDisposition: item.entry.decision.riskDisposition,
        evidenceActiveCount: item.entry.decision.evidenceActiveCount,
        evidenceIds: item.entry.decision.evidenceIds,
        forecastAvailable: Boolean(item.entry.decision.forecast?.available),
        scenarioLinked: Boolean(item.scenarioSetId || item.governanceSnapshot?.scenarioSetId),
        councilLinked: Boolean(item.councilRunId || item.governanceSnapshot?.councilRunId),
        executionLinked: true,
        outcomeLinked: null,
        primaryReason: item.entry.decision.primaryReason,
        reasons: item.entry.decision.reasons,
      });
      executionAuditScores.push(entryAudit.score);
      if (item.status === 'CLOSED' && item.latestDecision?.action === 'EXIT') {
        const trace = item.latestDecision;
        const exitAudit = assessAuditCompleteness({
          action: trace.action, timestamp: trace.timestamp, market: trace.market, regime: trace.regime, oracleTradeScore: trace.oracleTradeScore,
          confidence: trace.confidence, strategyDisposition: trace.strategyDisposition, riskDisposition: trace.riskDisposition,
          evidenceActiveCount: trace.evidenceActiveCount, evidenceIds: trace.evidenceIds, forecastAvailable: Boolean(trace.forecast?.available),
          scenarioLinked: Boolean(trace.governance?.scenarioSetId || item.scenarioSetId || item.governanceSnapshot?.scenarioSetId),
          councilLinked: Boolean(trace.governance?.councilRunId || item.councilRunId || item.governanceSnapshot?.councilRunId),
          executionLinked: Boolean(item.closedAt), outcomeLinked: Boolean(item.closedAt), primaryReason: trace.primaryReason, reasons: trace.reasons,
        });
        executionAuditScores.push(exitAudit.score);
      }
    }
    const actualExecutionEvents = actualEntryExecutions + checkpoint.session.closedTrades.length;
    const legacyUnlinkedExecutionEvents = Math.max(0, actualExecutionEvents - executionAuditScores.length);
    const auditScoreSum = executionAuditScores.reduce((sum, score) => sum + score, 0);
    const auditAverage = actualExecutionEvents > 0 ? auditScoreSum / (actualExecutionEvents * 100) : 0;
    const weakExecutions = executionAuditScores.filter((score) => score < 50).length + legacyUnlinkedExecutionEvents;

    const validationSamples = Array.isArray(checkpoint.loop.validationSamples) ? checkpoint.loop.validationSamples : [];
    const historicalValidation = summarizeValidationSamples(validationSamples, { minSamples: 60, minObservationDays: 14 });
    const walkForwardValidation = runWalkForwardValidation(validationSamples, { folds: 4, minimumTestSamples: 10 });
    const robustRegimes = historicalValidation.byRegime.filter((item) => item.samples >= 5);
    const regimeRobustnessPass = historicalValidation.verdict === 'PASS' && robustRegimes.length >= 2 && robustRegimes.every((item) => item.meanDirectionalReturn > 0);
    const costStressPass = validation.verdict === 'PASS';

    const liveEligibility = assessLiveEligibility({
      paperObservationDays: historicalValidation.observationDays,
      closedTrades: checkpoint.session.closedTrades.length,
      evidenceCoverage,
      evidenceLessEntries,
      auditAverage,
      weakExecutions,
      blindVerdict: historicalValidation.verdict,
      walkForwardVerdict: walkForwardValidation.verdict,
      monteCarloVerdict: validation.verdict,
      maxDrawdownPct: performance.maxDrawdownPct,
      // These long-horizon integrity facts are intentionally unavailable until the append-only Operator Event/Incident store is activated.
      dailyRiskBreaches: null,
      riskBypasses: null,
      staleOrDuplicateExecutionViolations: null,
      fatalRuntimeIncidents: null,
      unresolvedCriticalIncidents: null,
      regimeRobustnessPass,
      costStressPass,
      humanApproval: false,
    });

    const recentTrades = checkpoint.session.closedTrades.slice(-20).reverse().map((trade) => ({
      id: trade.id, market: trade.market, openedAt: trade.openedAt, closedAt: trade.closedAt, entryPrice: trade.entryPrice, exitPrice: trade.exitPrice,
      netPnl: trade.netPnl, returnPct: trade.returnPct, fees: trade.fees, exitReason: trade.exitReason, strategyVersion: trade.strategyVersion,
      entryOracleTradeScore: trade.entryOracleTradeScore, exitOracleTradeScore: trade.exitOracleTradeScore,
    }));
    const lastClosedTrade = checkpoint.session.closedTrades.length ? checkpoint.session.closedTrades[checkpoint.session.closedTrades.length - 1] : null;

    return response.status(200).json({
      success: true,
      available: true,
      status,
      now,
      mode: 'PAPER',
      strategyVersion: lastClosedTrade?.strategyVersion ?? null,
      checkpoint: { savedAt: checkpoint.savedAt, reason: checkpoint.reason, runtimeId: process.env.TRADING_RUNTIME_ID || 'black-oracle-paper', backend: 'supabase' },
      loop: {
        cycleCount: checkpoint.loop.cycleCount, intervalMs: checkpoint.loop.config.intervalMs, maxMarkets: checkpoint.loop.config.maxMarkets,
        maxOpenPositions: checkpoint.loop.config.maxOpenPositions, marketHistoryPoints: checkpoint.loop.marketHistory?.length ?? 0,
        validationSamples: validationSamples.length,
        lastCycle: lastCycle ? { startedAt: lastCycle.startedAt, finishedAt: lastCycle.finishedAt, durationMs: Math.max(0, lastCycle.finishedAt - lastCycle.startedAt), scanned: lastCycle.scanned, entered: lastCycle.entered, exited: lastCycle.exited, held: lastCycle.held, noTrade: lastCycle.noTrade ?? 0, errors: lastCycle.errors } : null,
        ageMs: cycleAgeMs, stale,
      },
      governance: {
        mode: 'ENFORCE', policy: 'STRICT_CONSENSUS', engine: 'DETERMINISTIC_COUNCIL_CORE_V1', protectiveExitAuthority: true,
        entryRule: 'Fresh structured Evidence + persisted Scenario/Council support + deterministic Risk approval are required for a new Paper ENTER.',
      },
      portfolio: { initialEquity: portfolio.initialEquity, equity, cash: portfolio.cash, realizedPnl: portfolio.realizedPnl, feesPaid: portfolio.feesPaid, dailyPnlPct, currentDrawdownPct, openPositions: portfolio.positions },
      performance,
      validation,
      riskLab,
      historicalValidation,
      walkForwardValidation,
      liveEligibility,
      promotionAudit: {
        actualEntryExecutions,
        linkedEntryCases,
        legacyUnlinkedEntries,
        evidenceCoverage,
        evidenceLessEntries,
        auditAverage,
        weakExecutions,
        legacyUnlinkedExecutionEvents,
        regimeRobustnessPass,
        costStressPass,
      },
      exposureLab,
      correlation: { alignedReturnObservations: correlationObservationCount, markets: correlationSeries.map((item) => item.market), available: correlationObservationCount >= 10 },
      ingestion: { markedMarkets: checkpoint.session.markPrices.length, evidenceTotal: checkpoint.evidence.length, evidenceActive: activeEvidence.length, evidenceExpired: expiredEvidence, scannedMarketsLastCycle: lastCycle?.scanned ?? 0, lastCycleErrors: cycleErrors },
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
