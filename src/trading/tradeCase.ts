import type { DecisionTrace } from './decisionTrace';
import type { PaperFill, MultiTimeframeSnapshot } from './types';

export type TradeCaseAuditClass = 'COMPLETE' | 'TECHNICAL_ONLY' | 'LEGACY_TECHNICAL_ONLY' | 'INCOMPLETE';
export type TradeCaseStatus = 'OPEN' | 'CLOSED';

export interface TradeCaseEntrySnapshot {
  timestamp: number;
  referencePrice: number;
  fillPrice: number;
  notional: number;
  fee: number;
  slippageBps: number;
  strategyVersion: string;
  multiTimeframe: {
    action: MultiTimeframeSnapshot['action'];
    directionalScore: number;
    oracleTradeScore: number;
    confidence: number;
    aligned: boolean;
    positionRiskMultiplier: number;
    frames: {
      fourHour: { directionalScore: number; confidence: number; regime: string };
      oneHour: { directionalScore: number; confidence: number; regime: string };
      fifteenMinute: { directionalScore: number; confidence: number; regime: string };
    };
  };
  decision: {
    action: DecisionTrace['action'];
    regime: DecisionTrace['regime'];
    regimeConfidence: number;
    route: DecisionTrace['strategyDisposition'];
    riskDisposition: DecisionTrace['riskDisposition'];
    eventScore: number | null;
    evidenceIds: string[];
    evidenceActiveCount: number;
    evidenceContradictionCount: number;
    forecast: DecisionTrace['forecast'];
    primaryReason: string;
    reasons: string[];
    riskReasons: string[];
  };
}

export interface TradeCaseRecord {
  id: string;
  market: string;
  status: TradeCaseStatus;
  auditClass: TradeCaseAuditClass;
  openedAt: number;
  closedAt: number | null;
  entry: TradeCaseEntrySnapshot;
  latestDecision: DecisionTrace;
  decisionHistory: DecisionTrace[];
  intelligencePackageId: string | null;
  councilRunId: string | null;
  finalDecisionId: string | null;
  supervisionNotes: string[];
}

const frame = (snapshot: any) => ({
  directionalScore: Number(snapshot?.fusion?.directionalScore ?? 0),
  confidence: Number(snapshot?.fusion?.confidence ?? 0),
  regime: String(snapshot?.regime?.regime ?? 'UNKNOWN'),
});

export const buildTradeCaseRecord = (input: {
  market: string;
  fill: PaperFill;
  trace: DecisionTrace;
  multiTimeframe: MultiTimeframeSnapshot;
}): TradeCaseRecord => {
  const evidenceLinked = input.trace.evidenceIds.length > 0 && input.trace.forecast.available;
  const auditClass: TradeCaseAuditClass = evidenceLinked ? 'COMPLETE' : 'TECHNICAL_ONLY';
  const id = `tradecase-${input.market.toLowerCase()}-${input.fill.timestamp}`;

  return {
    id,
    market: input.market.toUpperCase(),
    status: 'OPEN',
    auditClass,
    openedAt: input.fill.timestamp,
    closedAt: null,
    entry: {
      timestamp: input.fill.timestamp,
      referencePrice: input.fill.referencePrice,
      fillPrice: input.fill.fillPrice,
      notional: input.fill.notional,
      fee: input.fill.fee,
      slippageBps: input.fill.slippageBps,
      strategyVersion: input.fill.strategyVersion,
      multiTimeframe: {
        action: input.multiTimeframe.action,
        directionalScore: input.multiTimeframe.directionalScore,
        oracleTradeScore: input.multiTimeframe.oracleTradeScore,
        confidence: input.multiTimeframe.confidence,
        aligned: input.multiTimeframe.aligned,
        positionRiskMultiplier: input.multiTimeframe.positionRiskMultiplier,
        frames: {
          fourHour: frame(input.multiTimeframe.frames.fourHour),
          oneHour: frame(input.multiTimeframe.frames.oneHour),
          fifteenMinute: frame(input.multiTimeframe.frames.fifteenMinute),
        },
      },
      decision: {
        action: input.trace.action,
        regime: input.trace.regime,
        regimeConfidence: input.trace.regimeConfidence,
        route: input.trace.strategyDisposition,
        riskDisposition: input.trace.riskDisposition,
        eventScore: input.trace.eventScore,
        evidenceIds: input.trace.evidenceIds.slice(),
        evidenceActiveCount: input.trace.evidenceActiveCount,
        evidenceContradictionCount: input.trace.evidenceContradictionCount,
        forecast: { ...input.trace.forecast, evidenceIds: input.trace.forecast.evidenceIds.slice(), reasons: input.trace.forecast.reasons.slice() },
        primaryReason: input.trace.primaryReason,
        reasons: input.trace.reasons.slice(),
        riskReasons: input.trace.riskReasons.slice(),
      },
    },
    latestDecision: { ...input.trace, evidenceIds: input.trace.evidenceIds.slice(), reasons: input.trace.reasons.slice(), riskReasons: input.trace.riskReasons.slice() },
    decisionHistory: [{ ...input.trace, evidenceIds: input.trace.evidenceIds.slice(), reasons: input.trace.reasons.slice(), riskReasons: input.trace.riskReasons.slice() }],
    intelligencePackageId: null,
    councilRunId: null,
    finalDecisionId: null,
    supervisionNotes: evidenceLinked
      ? ['Entry was opened with structured evidence and an evidence-backed forecast available.']
      : ['Entry was opened from technical/liquidity/risk gates without structured external evidence or Council review.'],
  };
};
