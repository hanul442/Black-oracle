const supabaseOperationalRead = async (path: string, params: Record<string, string>) => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  if (!base || !key) return [] as any[];
  const url = new URL(`${base}/rest/v1/${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const result = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!result.ok) return [] as any[];
  return result.json() as Promise<any[]>;
};

const loadOperationalEvidence = async (now: number) => {
  const [flow, requests, inbox] = await Promise.all([
    supabaseOperationalRead('black_oracle_external_evidence', {
      select: 'id,packet_outbox_id,event_id,market,title,direction,strength,reliability,source_type,source,observed_at,expires_at,rationale,materiality,impact_confidence,evidence_grade,evidence_score,citations,eligible_for_new_risk,analysis_model,analysis_version',
      expires_at: `gt.${new Date(now).toISOString()}`,
      order: 'observed_at.desc',
      limit: '30',
    }),
    supabaseOperationalRead('black_oracle_evidence_requests', {
      select: 'request_key,market,asset_class,aliases,status,trigger,reason,requested_at,required_by,last_attempt_at,fulfilled_at,evidence_ids,strategy_id',
      order: 'requested_at.desc',
      limit: '30',
    }),
    supabaseOperationalRead('black_oracle_nars_inbox', {
      select: 'outbox_id,event_id,packet_type,producer,authority,execution_authority,mapped_markets,status,received_at,analyzed_at,last_error',
      order: 'received_at.desc',
      limit: '30',
    }),
  ]);
  return { flow, requests, inbox };
};

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

    const [{ tradingCheckpointStore }, { buildPaperPerformance }, { buildMonteCarloValidation }] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../src/trading/performance.js'),
      import('../src/trading/monteCarlo.js'),
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
    const operationalEvidence = await loadOperationalEvidence(now).catch(() => ({ flow: [], requests: [], inbox: [] }));
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
    const validation = buildMonteCarloValidation(
      checkpoint.session.closedTrades.map((trade) => trade.returnPct),
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
      technicalEvidence: item.technicalEvidence ?? null,
      structure: item.structure ?? null,
      cycle: item.cycle ?? null,
      microstructure: item.microstructure ?? null,
      challenger: item.challenger ?? null,
      tradeMap: item.tradeMap ?? null,
      primaryReason: item.primaryReason ?? null,
      reasons: Array.isArray(item.reasons) ? item.reasons : [],
      riskReasons: Array.isArray(item.riskReasons) ? item.riskReasons : [],
    }));

    const equityDecisions = ((lastCycle as any)?.equityCycle?.decisions ?? []).map((item: any) => ({
      ...item,
      timestamp: (lastCycle as any)?.equityCycle?.finishedAt ?? checkpoint.savedAt,
      assetClass: 'EQUITY',
    }));

    const recentTrades = checkpoint.session.closedTrades.slice(-40).reverse().map((trade) => ({
      id: trade.id,
      market: trade.market,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.quantity,
      grossPnl: trade.grossPnl,
      netPnl: trade.netPnl,
      returnPct: trade.returnPct,
      fees: trade.fees,
      exitReason: trade.exitReason,
      strategyVersion: trade.strategyVersion,
      entryOracleTradeScore: trade.entryOracleTradeScore,
      exitOracleTradeScore: trade.exitOracleTradeScore,
      entryAudit: trade.entryAudit ?? null,
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
          evidenceOps: (lastCycle as any).evidenceOps ?? null,
          equityCycle: (lastCycle as any).equityCycle ?? null,
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
      ingestion: {
        markedMarkets: checkpoint.session.markPrices.length,
        evidenceTotal: checkpoint.evidence.length,
        evidenceActive: activeEvidence.length,
        evidenceExpired: expiredEvidence,
        externalEvidenceActive: operationalEvidence.flow.length,
        evidenceRequests: operationalEvidence.requests.length,
        narsInboxRecent: operationalEvidence.inbox.length,
        scannedMarketsLastCycle: lastCycle?.scanned ?? 0,
        lastCycleErrors: cycleErrors,
      },
      evidenceFlow: operationalEvidence.flow,
      evidenceRequests: operationalEvidence.requests,
      narsInbox: operationalEvidence.inbox,
      equityCurve: portfolio.equityCurve.slice(-120),
      decisionTape,
      equityDecisions,
      recentTrades,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown trading status error.';
    console.error('Black Oracle trading status error:', error);
    return response.status(500).json({ success: false, available: false, status: 'ERROR', error: message });
  }
}
