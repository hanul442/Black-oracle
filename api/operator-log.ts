import { assessAuditCompleteness } from '../src/trading/auditCompleteness.js';

const evidenceStateFor = (item: any) => (item.evidenceActiveCount ?? 0) > 0
  ? (item.evidenceContradictionCount ?? 0) > 0 ? 'CONTESTED' : 'SUPPORTED'
  : 'TECHNICAL_ONLY';

const decisionFingerprint = (item: any) => [
  item.decision,
  item.regime ?? 'UNKNOWN',
  item.strategyDisposition ?? 'NO_ROUTE',
  item.riskDisposition ?? 'NOT_EVALUATED',
  evidenceStateFor(item),
  item.forecast?.available ? item.forecast.direction : 'NO_FORECAST',
  item.governance?.intelligenceDisposition ?? 'NO_GOVERNANCE',
  item.governance?.recommendedScenarioId ?? 'NO_SCENARIO',
  item.primaryReason ?? '',
].join('|');

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
      return response.status(503).json({ success: false, available: false, error: 'Operator log requires Supabase persistence in this deployment.' });
    }
    const { tradingCheckpointStore } = await import('../server/trading/persistence.js');
    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) {
      return response.status(200).json({ success: true, available: false, cycles: [], decisions: [], monitorDecisions: [], evidenceTransitions: [], governanceTransitions: [], errors: [], message: 'No Paper checkpoint has been saved yet.' });
    }

    const rawLimit = Number(request.query?.limit ?? 48);
    const limit = Number.isInteger(rawLimit) ? Math.min(96, Math.max(1, rawLimit)) : 48;
    const storedHistory = Array.isArray(checkpoint.loop.cycleHistory) ? checkpoint.loop.cycleHistory : [];
    const history = storedHistory.length ? storedHistory.slice(-limit) : checkpoint.loop.lastCycle ? [checkpoint.loop.lastCycle] : [];
    const firstCycleNumber = Math.max(1, checkpoint.loop.cycleCount - history.length + 1);
    const tradeCases = Array.isArray(checkpoint.tradeCases) ? checkpoint.tradeCases : [];

    const cycles = history.map((cycle, index) => ({
      cycleNumber: firstCycleNumber + index, startedAt: cycle.startedAt, finishedAt: cycle.finishedAt,
      durationMs: Math.max(0, cycle.finishedAt - cycle.startedAt), scanned: cycle.scanned, entered: cycle.entered,
      exited: cycle.exited, held: cycle.held, noTrade: cycle.noTrade ?? 0, errorCount: cycle.errors.length,
    }));

    const findCaseForDecision = (market: string, timestamp: number) => tradeCases
      .filter((item) => item.market === market && item.openedAt <= timestamp && (item.closedAt == null || timestamp <= item.closedAt + 60_000))
      .sort((a, b) => b.openedAt - a.openedAt)[0] ?? null;

    const chronologicalDecisions = history.flatMap((cycle, index) => {
      const cycleNumber = firstCycleNumber + index;
      return cycle.markets.map((item) => {
        const timestamp = item.timestamp ?? cycle.finishedAt;
        const tradeCase = findCaseForDecision(item.market, timestamp);
        const executionLinked = item.decision === 'ENTER'
          ? Boolean(tradeCase && Math.abs(tradeCase.entry.timestamp - timestamp) <= 60_000)
          : item.decision === 'EXIT'
            ? Boolean(tradeCase?.closedAt && Math.abs(tradeCase.closedAt - timestamp) <= 60_000)
            : null;
        const outcomeLinked = item.decision === 'EXIT' ? Boolean(tradeCase?.status === 'CLOSED' && tradeCase.closedAt) : null;
        const scenarioSetId = item.governance?.scenarioSetId ?? tradeCase?.scenarioSetId ?? tradeCase?.governanceSnapshot?.scenarioSetId ?? null;
        const councilRunId = item.governance?.councilRunId ?? tradeCase?.councilRunId ?? tradeCase?.governanceSnapshot?.councilRunId ?? null;
        const intelligencePackageId = item.governance?.intelligencePackageId ?? tradeCase?.intelligencePackageId ?? null;
        const auditCompleteness = assessAuditCompleteness({
          action: item.decision, timestamp, market: item.market, regime: item.regime ?? null,
          oracleTradeScore: item.oracleTradeScore ?? null, confidence: item.confidence ?? null,
          strategyDisposition: item.strategyDisposition ?? null, riskDisposition: item.riskDisposition ?? 'NOT_EVALUATED',
          evidenceActiveCount: item.evidenceActiveCount ?? 0, evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : [],
          forecastAvailable: Boolean(item.forecast?.available), scenarioLinked: Boolean(scenarioSetId), councilLinked: Boolean(councilRunId),
          executionLinked, outcomeLinked, primaryReason: item.primaryReason ?? null, reasons: Array.isArray(item.reasons) ? item.reasons : [],
        });

        return {
          cycleNumber, cycleFinishedAt: cycle.finishedAt, timestamp, market: item.market, decision: item.decision,
          regime: item.regime ?? null, regimeConfidence: item.regimeConfidence ?? null, oracleTradeScore: item.oracleTradeScore ?? null,
          confidence: item.confidence ?? null, strategyDisposition: item.strategyDisposition ?? null,
          riskDisposition: item.riskDisposition ?? 'NOT_EVALUATED', eventScore: item.eventScore ?? null, forecast: item.forecast ?? null,
          evidenceState: evidenceStateFor(item), evidenceActiveCount: item.evidenceActiveCount ?? 0,
          evidenceContradictionCount: item.evidenceContradictionCount ?? 0, evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds : [],
          primaryReason: item.primaryReason ?? null, reasons: Array.isArray(item.reasons) ? item.reasons : [],
          riskReasons: Array.isArray(item.riskReasons) ? item.riskReasons : [], tradeCaseId: tradeCase?.id ?? null,
          scenarioSetId, councilRunId, intelligencePackageId,
          governance: item.governance ? {
            finalDecisionId: item.governance.finalDecisionId ?? null,
            baseAction: item.governance.baseAction ?? null,
            mode: item.governance.mode ?? null,
            policy: item.governance.policy ?? null,
            intelligenceDisposition: item.governance.intelligenceDisposition ?? null,
            intelligenceConfidence: item.governance.intelligenceConfidence ?? null,
            recommendedScenarioId: item.governance.recommendedScenarioId ?? null,
            reasons: Array.isArray(item.governance.reasons) ? item.governance.reasons : [],
          } : null,
          auditCompleteness,
          fingerprint: decisionFingerprint(item),
        };
      });
    });

    const monitorGroups: any[] = [];
    const latestGroupIndexByMarket = new Map<string, number>();
    for (const item of chronologicalDecisions) {
      const collapsible = item.decision === 'HOLD' || item.decision === 'NO_TRADE';
      const previousIndex = latestGroupIndexByMarket.get(item.market);
      const previous = previousIndex == null ? null : monitorGroups[previousIndex];
      if (collapsible && previous && previous.fingerprint === item.fingerprint && previous.decision === item.decision) {
        previous.repeatCount += 1; previous.lastTimestamp = item.timestamp; previous.lastCycleNumber = item.cycleNumber;
        previous.timestamp = item.timestamp; previous.cycleNumber = item.cycleNumber; previous.auditCompleteness = item.auditCompleteness;
        continue;
      }
      monitorGroups.push({ ...item, repeatCount: 1, firstTimestamp: item.timestamp, lastTimestamp: item.timestamp, firstCycleNumber: item.cycleNumber, lastCycleNumber: item.cycleNumber });
      latestGroupIndexByMarket.set(item.market, monitorGroups.length - 1);
    }

    const evidenceTransitions: any[] = [];
    const previousEvidenceState = new Map<string, string>();
    const governanceTransitions: any[] = [];
    const previousGovernanceState = new Map<string, string>();
    for (const item of chronologicalDecisions) {
      const previousEvidence = previousEvidenceState.get(item.market);
      if (previousEvidence && previousEvidence !== item.evidenceState) {
        evidenceTransitions.push({ cycleNumber: item.cycleNumber, timestamp: item.timestamp, market: item.market, from: previousEvidence, to: item.evidenceState, resolved: item.evidenceState === 'SUPPORTED', evidenceIds: item.evidenceIds });
      }
      previousEvidenceState.set(item.market, item.evidenceState);

      const governanceState = item.governance?.intelligenceDisposition ?? 'UNAVAILABLE';
      const previousGovernance = previousGovernanceState.get(item.market);
      if (previousGovernance && previousGovernance !== governanceState) {
        governanceTransitions.push({
          cycleNumber: item.cycleNumber, timestamp: item.timestamp, market: item.market,
          from: previousGovernance, to: governanceState, scenarioSetId: item.scenarioSetId,
          councilRunId: item.councilRunId, recommendedScenarioId: item.governance?.recommendedScenarioId ?? null,
        });
      }
      previousGovernanceState.set(item.market, governanceState);
    }

    const errors = history.flatMap((cycle, index) => {
      const cycleNumber = firstCycleNumber + index;
      return cycle.errors.map((item) => ({ cycleNumber, timestamp: cycle.finishedAt, market: item.market, error: item.error }));
    });
    const decisions = chronologicalDecisions.slice(-600).reverse();
    const auditScores = decisions.map((item) => item.auditCompleteness.score);

    return response.status(200).json({
      success: true, available: true, now: Date.now(), runtimeId: process.env.TRADING_RUNTIME_ID || 'black-oracle-paper',
      checkpointSavedAt: checkpoint.savedAt, cycleCount: checkpoint.loop.cycleCount, retainedCycles: history.length,
      retainedValidationSamples: Array.isArray(checkpoint.loop.validationSamples) ? checkpoint.loop.validationSamples.length : 0,
      historyAvailable: storedHistory.length > 1, cycles: cycles.slice().reverse(), decisions,
      monitorDecisions: monitorGroups.slice(-300).reverse(), evidenceTransitions: evidenceTransitions.slice(-100).reverse(),
      governanceTransitions: governanceTransitions.slice(-100).reverse(), errors: errors.slice(-200).reverse(),
      auditSummary: {
        averageScore: auditScores.length ? Math.round(auditScores.reduce((sum, score) => sum + score, 0) / auditScores.length) : 0,
        complete: decisions.filter((item) => item.auditCompleteness.grade === 'COMPLETE').length,
        weak: decisions.filter((item) => item.auditCompleteness.grade === 'WEAK').length,
        missingEvidence: decisions.filter((item) => item.auditCompleteness.missing.includes('EVIDENCE')).length,
        missingScenario: decisions.filter((item) => item.auditCompleteness.missing.includes('FORECAST_SCENARIO')).length,
        missingCouncil: decisions.filter((item) => item.auditCompleteness.missing.includes('COUNCIL')).length,
        missingExecutionTrace: decisions.filter((item) => item.auditCompleteness.missing.includes('EXECUTION_TRACE')).length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown operator log error.';
    console.error('Black Oracle operator log error:', error);
    return response.status(500).json({ success: false, available: false, error: message });
  }
}
