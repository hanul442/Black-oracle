import { assessAuditCompleteness } from '../src/trading/auditCompleteness.js';

const simplifyTrace = (trace: any, links: { scenarioSetId?: string | null; councilRunId?: string | null; executionLinked?: boolean | null; outcomeLinked?: boolean | null }) => {
  if (!trace) return null;
  const governance = trace.governance ? {
    finalDecisionId: trace.governance.finalDecisionId ?? null,
    baseAction: trace.governance.baseAction ?? null,
    mode: trace.governance.mode ?? null,
    policy: trace.governance.policy ?? null,
    intelligenceDisposition: trace.governance.intelligenceDisposition ?? null,
    intelligenceConfidence: trace.governance.intelligenceConfidence ?? null,
    intelligencePackageId: trace.governance.intelligencePackageId ?? null,
    scenarioSetId: trace.governance.scenarioSetId ?? null,
    recommendedScenarioId: trace.governance.recommendedScenarioId ?? null,
    councilRunId: trace.governance.councilRunId ?? null,
    reasons: Array.isArray(trace.governance.reasons) ? trace.governance.reasons : [],
  } : null;
  const scenarioLinked = Boolean(governance?.scenarioSetId || links.scenarioSetId);
  const councilLinked = Boolean(governance?.councilRunId || links.councilRunId);
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
    scenarioLinked,
    councilLinked,
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
    governance,
    auditCompleteness,
  };
};

const simplifyGovernanceSnapshot = (snapshot: any) => snapshot ? ({
  intelligencePackageId: snapshot.intelligencePackageId ?? null,
  scenarioSetId: snapshot.scenarioSetId ?? null,
  councilRunId: snapshot.councilRunId ?? null,
  finalDecisionId: snapshot.finalDecisionId ?? null,
  generatedAt: snapshot.generatedAt ?? null,
  expiresAt: snapshot.expiresAt ?? null,
  recommendedScenarioId: snapshot.recommendedScenarioId ?? null,
  scenarios: (Array.isArray(snapshot.scenarios) ? snapshot.scenarios : []).map((item: any) => ({
    id: item.id, market: item.market, label: item.label, probability: item.probability, confidence: item.confidence, direction: item.direction,
    thesis: item.thesis, triggerConditions: Array.isArray(item.triggerConditions) ? item.triggerConditions : [], invalidationConditions: Array.isArray(item.invalidationConditions) ? item.invalidationConditions : [],
    watchItems: Array.isArray(item.watchItems) ? item.watchItems : [], evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : [],
  })),
  councilRankings: (Array.isArray(snapshot.councilRankings) ? snapshot.councilRankings : []).map((item: any) => ({
    scenarioId: item.scenarioId, rank: item.rank, consensusScore: item.consensusScore, probabilityEstimate: item.probabilityEstimate, confidence: item.confidence,
    disposition: item.disposition, dominantSupport: item.dominantSupport, dominantChallenge: item.dominantChallenge,
    unresolvedUncertainty: Array.isArray(item.unresolvedUncertainty) ? item.unresolvedUncertainty : [], preservedDissent: Array.isArray(item.preservedDissent) ? item.preservedDissent : [],
  })),
  lensReviews: (Array.isArray(snapshot.lensReviews) ? snapshot.lensReviews : []).map((item: any) => ({
    lensId: item.lensId, scenarioId: item.scenarioId, stance: item.stance, confidence: item.confidence, reasons: Array.isArray(item.reasons) ? item.reasons : [],
  })),
}) : null;

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
          timestamp: item.entry.timestamp, market: item.market, action: item.entry.decision.action, regime: item.entry.decision.regime,
          regimeConfidence: item.entry.decision.regimeConfidence, oracleTradeScore: item.entry.multiTimeframe.oracleTradeScore, confidence: item.entry.multiTimeframe.confidence,
          strategyDisposition: item.entry.decision.route, riskDisposition: item.entry.decision.riskDisposition, eventScore: item.entry.decision.eventScore,
          forecast: item.entry.decision.forecast, evidenceActiveCount: item.entry.decision.evidenceActiveCount, evidenceContradictionCount: item.entry.decision.evidenceContradictionCount,
          evidenceIds: item.entry.decision.evidenceIds, primaryReason: item.entry.decision.primaryReason, reasons: item.entry.decision.reasons, riskReasons: item.entry.decision.riskReasons,
          governance: item.latestDecision?.governance && item.latestDecision.timestamp === item.entry.timestamp ? item.latestDecision.governance : undefined,
        };
        const scenarioSetId = item.scenarioSetId ?? item.governanceSnapshot?.scenarioSetId ?? null;
        const councilRunId = item.councilRunId ?? item.governanceSnapshot?.councilRunId ?? null;

        return {
          id: item.id, market: item.market, status: item.status, auditClass: item.auditClass, openedAt: item.openedAt, closedAt: item.closedAt,
          intelligencePackageId: item.intelligencePackageId ?? null, scenarioSetId, councilRunId, finalDecisionId: item.finalDecisionId ?? null,
          supervisionNotes: Array.isArray(item.supervisionNotes) ? item.supervisionNotes : [],
          governanceSnapshot: simplifyGovernanceSnapshot(item.governanceSnapshot),
          entry: {
            timestamp: item.entry.timestamp, referencePrice: item.entry.referencePrice, fillPrice: item.entry.fillPrice, notional: item.entry.notional, fee: item.entry.fee,
            slippageBps: item.entry.slippageBps, strategyVersion: item.entry.strategyVersion, multiTimeframe: item.entry.multiTimeframe,
            trace: simplifyTrace(entryTrace, { scenarioSetId, councilRunId, executionLinked: true }),
          },
          latestDecision: simplifyTrace(item.latestDecision, {
            scenarioSetId, councilRunId,
            executionLinked: item.latestDecision?.action === 'ENTER' ? true : item.latestDecision?.action === 'EXIT' ? Boolean(item.closedAt) : null,
            outcomeLinked: item.latestDecision?.action === 'EXIT' ? Boolean(item.status === 'CLOSED' && item.closedAt) : null,
          }),
          decisionHistory: (Array.isArray(item.decisionHistory) ? item.decisionHistory : []).slice(-96).reverse().map((trace) => simplifyTrace(trace, {
            scenarioSetId: trace.governance?.scenarioSetId ?? scenarioSetId,
            councilRunId: trace.governance?.councilRunId ?? councilRunId,
            executionLinked: trace.action === 'ENTER' ? true : trace.action === 'EXIT' ? Boolean(item.closedAt) : null,
            outcomeLinked: trace.action === 'EXIT' ? Boolean(item.status === 'CLOSED' && item.closedAt) : null,
          })),
        };
      });

    return response.status(200).json({ success: true, available: true, now: Date.now(), checkpointSavedAt: checkpoint.savedAt, cases });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown trade-case read error.';
    console.error('Black Oracle trade-case read error:', error);
    return response.status(500).json({ success: false, available: false, error: message });
  }
}
