import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileSearch2 } from 'lucide-react';

type EntryAudit = {
  timestamp: number;
  eventScore: number | null;
  regime: string;
  regimeConfidence: number;
  structure: null | {
    bias: string;
    confidence: number;
    eventType: string | null;
    eventDirection: string | null;
    location: string;
    percentile: number;
  };
  cycle: null | {
    state: string;
    directionalScore: number;
    confidence: number;
    entryTiming: string;
    frames: { fourHour: number; oneHour: number; fifteenMinute: number };
  };
  technicalEvidence: null | {
    rawSignalCount: number;
    independentFamilyCount: number;
    correlatedSignalPenalty: number;
    directionalScore: number;
    confidence: number;
    bullishFamilies: number;
    bearishFamilies: number;
    neutralFamilies: number;
  };
  tradeMap: {
    status: string;
    direction: string;
    entryPrice: number | null;
    structuralInvalidationPrice: number | null;
    stopLossPrice: number | null;
    takeProfit1Price: number | null;
    takeProfit2Price: number | null;
    riskReward1: number | null;
    riskReward2: number | null;
    expectedRiskPct: number | null;
    reasons?: string[];
  };
};

export type AuditedClosedTrade = {
  id: string;
  market: string;
  openedAt: number;
  closedAt: number;
  entryPrice: number;
  exitPrice: number;
  netPnl: number;
  returnPct: number;
  exitReason: string;
  entryOracleTradeScore: number;
  exitOracleTradeScore: number;
  entryAudit?: EntryAudit | null;
};

const price = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—'
  : `₩${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value)}`;

const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—'
  : `${(value * 100).toFixed(2)}%`;

const time = (value: number | null | undefined) => value
  ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : '—';

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0 bg-[#060A0E] px-3 py-2.5">
    <div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#46515B]">{label}</div>
    <div className="mt-1 truncate font-mono text-[8px] text-[#AEB7BF]">{value}</div>
  </div>
);

export const TradeAuditHistory: React.FC<{ trades: AuditedClosedTrade[] }> = ({ trades }) => {
  const auditable = useMemo(() => trades.filter((trade) => trade.entryAudit), [trades]);
  const [selectedId, setSelectedId] = useState<string | null>(auditable[0]?.id ?? null);

  useEffect(() => {
    if (!auditable.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !auditable.some((trade) => trade.id === selectedId)) setSelectedId(auditable[0].id);
  }, [auditable, selectedId]);

  if (!auditable.length) return null;
  const selected = auditable.find((trade) => trade.id === selectedId) ?? auditable[0];
  const audit = selected.entryAudit!;

  return (
    <details className="group shrink-0 border-b border-white/[0.06] bg-[#05080C]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 md:px-6 xl:px-8">
        <FileSearch2 className="h-3.5 w-3.5 text-[#74818B]" />
        <span className="font-mono text-[7px] uppercase tracking-[0.17em] text-[#8C98A2]">Closed trade audit</span>
        <span className="font-mono text-[6px] uppercase tracking-[0.1em] text-[#4F5963]">{auditable.length} audit-rich recent trade(s)</span>
        <span className="ml-auto font-mono text-[6px] uppercase tracking-[0.1em] text-[#56616C]">click to inspect</span>
        <ChevronDown className="h-3.5 w-3.5 text-[#56616C] transition group-open:rotate-180" />
      </summary>

      <div className="border-t border-white/[0.05] px-4 py-3 md:px-6 xl:px-8">
        <div className="mx-auto max-w-[1520px]">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {auditable.map((trade) => (
              <button
                key={trade.id}
                type="button"
                onClick={() => setSelectedId(trade.id)}
                className={`shrink-0 border px-3 py-2 text-left transition ${trade.id === selected.id ? 'border-[#70CAD2]/30 bg-[#70CAD2]/[0.04]' : 'border-white/[0.07] bg-[#070B10] hover:border-white/[0.14]'}`}
              >
                <div className="font-mono text-[8px] text-[#C8D0D6]">{trade.market}</div>
                <div className="mt-1 font-mono text-[6px] text-[#59636D]">{time(trade.closedAt)} · {pct(trade.returnPct)}</div>
              </button>
            ))}
          </div>

          <div className="mt-2 grid gap-px bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Stat label="ENTRY / EXIT" value={`${price(selected.entryPrice)} → ${price(selected.exitPrice)}`} />
            <Stat label="ORACLE SCORE" value={`${selected.entryOracleTradeScore} → ${selected.exitOracleTradeScore}`} />
            <Stat label="REGIME" value={`${audit.regime} · ${pct(audit.regimeConfidence)}`} />
            <Stat label="STRUCTURE" value={audit.structure ? `${audit.structure.eventType ?? '—'} ${audit.structure.bias} · ${audit.structure.location}` : '—'} />
            <Stat label="CYCLE" value={audit.cycle ? `${audit.cycle.state} · ${audit.cycle.entryTiming}` : '—'} />
            <Stat label="EVIDENCE FAMILIES" value={audit.technicalEvidence ? `${audit.technicalEvidence.bullishFamilies}↑ / ${audit.technicalEvidence.bearishFamilies}↓ / ${audit.technicalEvidence.neutralFamilies}·` : '—'} />
            <Stat label="CORR PENALTY" value={pct(audit.technicalEvidence?.correlatedSignalPenalty)} />
            <Stat label="EVENT SCORE" value={audit.eventScore == null ? '—' : String(audit.eventScore)} />
          </div>

          <div className="mt-px grid gap-px bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Stat label="ENTRY" value={price(audit.tradeMap.entryPrice)} />
            <Stat label="INVALIDATION" value={price(audit.tradeMap.structuralInvalidationPrice)} />
            <Stat label="STOP" value={price(audit.tradeMap.stopLossPrice)} />
            <Stat label="TP1" value={price(audit.tradeMap.takeProfit1Price)} />
            <Stat label="TP2" value={price(audit.tradeMap.takeProfit2Price)} />
            <Stat label="R:R / RISK" value={`${audit.tradeMap.riskReward2?.toFixed(2) ?? '—'}R · ${pct(audit.tradeMap.expectedRiskPct)}`} />
          </div>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-3 border border-white/[0.05] bg-[#06090D] px-3 py-2.5 text-[8px] leading-relaxed text-[#68737D]">
            <span>{audit.tradeMap.reasons?.[0] ?? 'Entry audit is persisted from the decision-time snapshot.'}</span>
            <span className="font-mono text-[6px] uppercase tracking-[0.1em] text-[#46515B]">exit · {selected.exitReason}</span>
          </div>
        </div>
      </div>
    </details>
  );
};
