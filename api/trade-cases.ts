import { assessAuditCompleteness } from '../src/trading/auditCompleteness.js';

const simplifyTrace = (trace: any, links: { councilRunId?: string | null; executionLinked?: boolean | null; outcomeLinked?: boolean | null }) => {
  if (!trace) return null;
  const auditCompleteness = assessAuditCompleteness({
    action: trace.action,
    timestamp: trace.timestamp,
    market: trace.market,
    regime: trace.regime ?? null,
    oracleTradeScore: trace.oracleTradeScore ?? null,
    confidence: trace.confidence ?? null,
    strategyDisposition: trace.strategyDisposition ?? null,
    riskDisposition: trace.riskDisposition ?? 'NOT_EVALUATED',
    evidenceActiveCount: trace.evidenceActiveCount ?? 0,
    evidenceIds: Array.isArray(trace.evidenceIds) ? trace.evidenceIds : [],
    forecastAvailable: Boolean(trace.forecast?.available),
    scenarioLinked: false,
    councilLinked: Boolean(links.councilRunId),
    executionLinked: links.executionLinked,
    outcomeLinked: links.outcomeLinked,
    primaryReason: trace.primaryReason ?? null,
    reasons: Array.isArray(trace.reasons) ? trace.reasons : [],
  });

  return {
    timestamp: trace.timestamp,
    market: trace.market,
    action: trace.action,
    regime: trace.regime ?? null,
    regimeConfidence: trace.regimeConfidence ?? null,
    oracleTradeScore: trace.oracleTradeScore ?? null,
    confidence: trace.confidence ?? null,
    strategyDisposition: trace.strategyDisposition ?? null,
    riskDisposition: trace.riskDisposition ?? 'NOT_EVALUATED',
    eventScore: trace.eventScore ?? null,
    forecast: trace.forecast ?? null,
    evidenceActiveCount: trace.evidenceActiveCount ?? 0,
    evidenceContradictionCount: trace.evidenceContradictionCount ?? 0,
    evidenceIds: Array.isArray(trace.evidenceIds) ? trace.evidenceIds : [],
    primaryReason: trace.primaryReason ?? null,
    reasons: Array.isArray(trace.reasons) ? trace.reasons : [],
    riskReasons: Array.isArray(trace.riskReasons) ? trace.riskReasons : [],
    auditCompleteness,
  };
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
      return response.status(503).json({ success: false, available: false, error: 'Trade cases require Supabase persistence in this deployment.' });
    }
    const { tradingCheckpointStore } = await import('../server/trading/persistence.js');
    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) return response.status(200).json({ success: true, available: false, cases: [] });

    const marketFilter = String(request.query?.market ?? '').trim().toUpperCase();
    const cases = (Array.isArray(checkpoint.tradeCases) ? checkpoint.tradeCases : [])
      .filter((item) => !marketFilter || item.market === marketFilter)
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, marketFilter ? 20 : 100)
      .map((item) => {
        const entryTrace = {
          timestamp: item.entry.timestamp,
          market: item.market,
          action: item.entry.decision.action,
          regime: item.entry.decision.regime,
          regimeConfidence: item.entry.decision.regimeConfidence,
          oracleTradeScore: item.entry.multiTimeframe.oracleTradeScore,
          confidence: item.entry.multiTimeframe.confidence,
          strategyDisposition: item.entry.decision.route,
          riskDisposition: item.entry.decision.riskDisposition,
          eventScore: item.entry.decision.eventScore,
          forecast: item.entry.decision.forecast,
          evidenceActiveCount: item.entry.decision.evidenceActiveCount,
          evidenceContradictionCount: item.entry.decision.evidenceContradictionCount,
          evidenceIds: item.entry.decision.evidenceIds,
          primaryReason: item.entry.decision.primaryReason,
          reasons: item.entry.decision.reasons,
          riskReasons: item.entry.decision.riskReasons,
        };

        return {
          id: item.id,
          market: item.market,
          status: item.status,
          auditClass: item.auditClass,
          openedAt: item.openedAt,
          closedAt: item.closedAt,
          intelligencePackageId: item.intelligencePackageId ?? null,
          councilRunId: item.councilRunId ?? null,
          finalDecisionId: item.finalDecisionId ?? null,
          supervisionNotes: Array.isArray(item.supervisionNotes) ? item.supervisionNotes : [],
          entry: {
            timestamp: item.entry.timestamp,
            referencePrice: item.entry.referencePrice,
            fillPrice: item.entry.fillPrice,
            notional: item.entry.notional,
            fee: item.entry.fee,
            slippageBps: item.entry.slippageBps,
            strategyVersion: item.entry.strategyVersion,
            multiTimeframe: item.entry.multiTimeframe,
            trace: simplifyTrace(entryTrace, { councilRunId: item.councilRunId, executionLinked: true }),
          },
          latestDecision: simplifyTrace(item.latestDecision, {
            councilRunId: item.councilRunId,
            executionLinked: item.latestDecision?.action === 'ENTER'
              ? true
              : item.latestDecision?.action === 'EXIT'
                ? Boolean(item.closedAt)
                : null,
            outcomeLinked: item.latestDecision?.action === 'EXIT' ? Boolean(item.status === 'CLOSED' && item.closedAt) : null,
          }),
          decisionHistory: (Array.isArray(item.decisionHistory) ? item.decisionHistory : [])
            .slice(-96)
            .reverse()
            .map((trace) => simplifyTrace(trace, {
              councilRunId: item.councilRunId,
              executionLinked: trace.action === 'ENTER' ? true : trace.action === 'EXIT' ? Boolean(item.closedAt) : null,
              outcomeLinked: trace.action === 'EXIT' ? Boolean(item.status === 'CLOSED' && item.closedAt) : null,
            })),
        };
      });

    return response.status(200).json({
      success: true,
      available: true,
      now: Date.now(),
      checkpointSavedAt: checkpoint.savedAt,
      cases,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown trade-case read error.';
    console.error('Black Oracle trade-case read error:', error);
    return response.status(500).json({ success: false, available: false, error: message });
  }
}
