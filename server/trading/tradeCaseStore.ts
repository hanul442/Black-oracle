import type { DecisionTrace } from '../../src/trading/decisionTrace';
import type { GovernedTradingIntelligencePackage } from '../../src/trading/governanceCore';
import { buildTradeCaseGovernanceSnapshot, type TradeCaseRecord } from '../../src/trading/tradeCase';

const cloneTrace = (trace: DecisionTrace): DecisionTrace => ({
  ...trace,
  router: { ...trace.router, reasons: trace.router.reasons.slice() },
  forecast: { ...trace.forecast, evidenceIds: trace.forecast.evidenceIds.slice(), reasons: trace.forecast.reasons.slice() },
  evidenceIds: trace.evidenceIds.slice(),
  reasons: trace.reasons.slice(),
  riskReasons: trace.riskReasons.slice(),
  governance: trace.governance ? { ...trace.governance, reasons: trace.governance.reasons.slice() } : undefined,
});

const cloneRecord = (record: TradeCaseRecord): TradeCaseRecord => ({
  ...record,
  entry: {
    ...record.entry,
    multiTimeframe: {
      ...record.entry.multiTimeframe,
      frames: {
        fourHour: { ...record.entry.multiTimeframe.frames.fourHour },
        oneHour: { ...record.entry.multiTimeframe.frames.oneHour },
        fifteenMinute: { ...record.entry.multiTimeframe.frames.fifteenMinute },
      },
    },
    decision: {
      ...record.entry.decision,
      evidenceIds: record.entry.decision.evidenceIds.slice(),
      forecast: {
        ...record.entry.decision.forecast,
        evidenceIds: record.entry.decision.forecast.evidenceIds.slice(),
        reasons: record.entry.decision.forecast.reasons.slice(),
      },
      reasons: record.entry.decision.reasons.slice(),
      riskReasons: record.entry.decision.riskReasons.slice(),
    },
  },
  latestDecision: cloneTrace(record.latestDecision),
  decisionHistory: record.decisionHistory.map(cloneTrace),
  governanceSnapshot: record.governanceSnapshot ? {
    ...record.governanceSnapshot,
    scenarios: record.governanceSnapshot.scenarios.map((item) => ({ ...item, triggerConditions: item.triggerConditions.slice(), invalidationConditions: item.invalidationConditions.slice(), watchItems: item.watchItems.slice(), evidenceIds: item.evidenceIds.slice() })),
    councilRankings: record.governanceSnapshot.councilRankings.map((item) => ({ ...item, unresolvedUncertainty: item.unresolvedUncertainty.slice(), preservedDissent: item.preservedDissent.slice() })),
    lensReviews: record.governanceSnapshot.lensReviews.map((item) => ({ ...item, reasons: item.reasons.slice() })),
  } : record.governanceSnapshot,
  supervisionNotes: record.supervisionNotes.slice(),
});

export class TradeCaseStore {
  private readonly records = new Map<string, TradeCaseRecord>();

  replaceAll(records: TradeCaseRecord[]) {
    this.records.clear();
    for (const record of records || []) {
      if (!record?.id || !record?.market || !record?.entry) continue;
      this.records.set(record.id, cloneRecord(record));
    }
    return this.list();
  }

  recordEntry(record: TradeCaseRecord) { this.records.set(record.id, cloneRecord(record)); return this.get(record.id); }

  appendDecision(market: string, trace: DecisionTrace) {
    const open = this.findOpenByMarket(market);
    if (!open) return null;
    open.latestDecision = cloneTrace(trace);
    open.decisionHistory.push(cloneTrace(trace));
    if (open.decisionHistory.length > 512) open.decisionHistory.splice(0, open.decisionHistory.length - 512);
    this.records.set(open.id, open);
    return cloneRecord(open);
  }

  closeMarket(market: string, closedAt: number, trace?: DecisionTrace) {
    const open = this.findOpenByMarket(market);
    if (!open) return null;
    open.status = 'CLOSED'; open.closedAt = closedAt;
    if (trace) { open.latestDecision = cloneTrace(trace); open.decisionHistory.push(cloneTrace(trace)); }
    this.records.set(open.id, open);
    return cloneRecord(open);
  }

  linkIntelligence(market: string, links: { intelligencePackageId?: string | null; scenarioSetId?: string | null; councilRunId?: string | null; finalDecisionId?: string | null; note?: string }) {
    const open = this.findOpenByMarket(market); if (!open) return null;
    if (links.intelligencePackageId !== undefined) open.intelligencePackageId = links.intelligencePackageId;
    if (links.scenarioSetId !== undefined) open.scenarioSetId = links.scenarioSetId;
    if (links.councilRunId !== undefined) open.councilRunId = links.councilRunId;
    if (links.finalDecisionId !== undefined) open.finalDecisionId = links.finalDecisionId;
    if (links.note) open.supervisionNotes.push(links.note.slice(0, 500));
    if (open.supervisionNotes.length > 256) open.supervisionNotes.splice(0, open.supervisionNotes.length - 256);
    this.records.set(open.id, open); return cloneRecord(open);
  }

  linkGovernance(market: string, governance: GovernedTradingIntelligencePackage, finalDecisionId: string | null) {
    const open = this.findOpenByMarket(market); if (!open) return null;
    open.intelligencePackageId = governance.id;
    open.scenarioSetId = governance.scenarios.id;
    open.councilRunId = governance.council.id;
    open.finalDecisionId = finalDecisionId;
    open.governanceSnapshot = buildTradeCaseGovernanceSnapshot(governance, finalDecisionId);
    open.supervisionNotes.push(`Governance snapshot updated: ${governance.council.id}, recommended scenario ${governance.council.recommendedScenarioId ?? 'none'}.`);
    if (open.supervisionNotes.length > 256) open.supervisionNotes.splice(0, open.supervisionNotes.length - 256);
    this.records.set(open.id, open); return cloneRecord(open);
  }

  get(id: string) { const record = this.records.get(id); return record ? cloneRecord(record) : null; }
  findOpenByMarket(market: string) {
    const normalized = market.toUpperCase();
    const matches = Array.from(this.records.values()).filter((record) => record.market === normalized && record.status === 'OPEN').sort((a, b) => b.openedAt - a.openedAt);
    return matches[0] ? cloneRecord(matches[0]) : null;
  }
  list() { return Array.from(this.records.values()).sort((a, b) => b.openedAt - a.openedAt).map(cloneRecord); }
}

export const tradeCaseStore = new TradeCaseStore();
