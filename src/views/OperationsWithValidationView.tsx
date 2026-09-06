import React, { useEffect, useMemo, useState } from 'react';
import { Crosshair, ShieldCheck } from 'lucide-react';
import { TradeAuditHistory, type AuditedClosedTrade } from '../components/TradeAuditHistory';
import { OperationsView } from './OperationsView';

type Validation = {
  verdict: 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';
  available: boolean;
  tradeCount: number;
  scenarioCount: number;
  seed: number;
  horizonTrades: number;
  survivalProbability: number | null;
  ruinProbability: number | null;
  profitableProbability: number | null;
  terminalReturn: { p05: number | null; median: number | null; p95: number | null };
  maxDrawdown: { p05: number | null; median: number | null; p95: number | null; worst: number | null };
  thresholds: {
    drawdownLimitPct: number;
    passSurvivalProbability: number;
    watchSurvivalProbability: number;
  };
  assumptions: {
    bootstrapWithReplacement: true;
    costInflationBps: number;
    adverseShockPct: number;
    winnerHaircut: number;
    loserAmplification: number;
  };
  reasons: string[];
};

type AuditDecision = {
  timestamp: number;
  market: string;
  decision: string;
  structure?: null | {
    bias: string;
    confidence: number;
    eventType: string | null;
    eventDirection: string | null;
    location: string;
    percentile: number;
    liquiditySweep: string | null;
  };
  cycle?: null | {
    state: string;
    directionalScore: number;
    confidence: number;
    entryTiming: string;
    frames: { fourHour: number; oneHour: number; fifteenMinute: number };
  };
  technicalEvidence?: null | {
    rawSignalCount: number;
    independentFamilyCount: number;
    correlatedSignalPenalty: number;
    directionalScore: number;
    confidence: number;
    bullishFamilies: number;
    bearishFamilies: number;
    neutralFamilies: number;
  };
  tradeMap?: null | {
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
  };
};

type StatusPayload = {
  success?: boolean;
  available?: boolean;
  validation?: Validation;
  decisionTape?: AuditDecision[];
  recentTrades?: AuditedClosedTrade[];
};

const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—'
  : `${(value * 100).toFixed(1)}%`;

const price = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);

const toneFor = (verdict: Validation['verdict'] | undefined) => {
  if (verdict === 'PASS') return 'border-[#72B6A0]/20 bg-[#72B6A0]/[0.035] text-[#86C5B1]';
  if (verdict === 'REJECT') return 'border-[#D66565]/20 bg-[#D66565]/[0.035] text-[#D98787]';
  if (verdict === 'WATCH') return 'border-[#C7A96B]/20 bg-[#C7A96B]/[0.035] text-[#D3B778]';
  return 'border-white/[0.07] bg-[#080C11] text-[#7E8993]';
};

export const OperationsWithValidationView: React.FC = () => {
  const [payload, setPayload] = useState<StatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/trading-status', { cache: 'no-store' });
        const next = await response.json() as StatusPayload;
        if (!cancelled) setPayload(next);
      } catch {
        if (!cancelled) setPayload(null);
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const validation = payload?.validation ?? null;
  const verdict = validation?.verdict ?? 'INSUFFICIENT_DATA';
  const minimumTrades = 20;
  const latestAudit = useMemo(() => {
    const items = payload?.decisionTape ?? [];
    return items.reduce<AuditDecision | null>((latest, item) => !latest || item.timestamp > latest.timestamp ? item : latest, null);
  }, [payload?.decisionTape]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#05070A]">
      <div className={`shrink-0 border-b px-4 py-2.5 md:px-6 xl:px-8 ${toneFor(verdict)}`}>
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="font-mono text-[7px] uppercase tracking-[0.18em]">Monte Carlo validation</span>
            <span className="border border-current/20 px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.1em]">{verdict}</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[6px] uppercase tracking-[0.1em] text-[#69747E]">
            <span>{validation?.tradeCount ?? 0}/{minimumTrades} closed trades</span>
            <span>survival {pct(validation?.survivalProbability)}</span>
            <span>ruin {pct(validation?.ruinProbability)}</span>
            <span>P95 DD {pct(validation?.maxDrawdown.p95)}</span>
            <span>P05 terminal {pct(validation?.terminalReturn.p05)}</span>
            <span>{validation?.available ? `${validation.scenarioCount} scenarios · seed ${validation.seed}` : 'awaiting sample'}</span>
          </div>

          <div className="ml-auto font-mono text-[6px] uppercase tracking-[0.11em] text-[#4F5963]">
            validation only · no order authority
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-white/[0.06] bg-[#060A0E] px-4 py-2.5 md:px-6 xl:px-8">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2 text-[#70CAD2]">
            <Crosshair className="h-3.5 w-3.5" />
            <span className="font-mono text-[7px] uppercase tracking-[0.18em]">Evidence-attached trade map</span>
            {latestAudit && <span className="font-mono text-[7px] text-[#B7C0C8]">{latestAudit.market}</span>}
          </div>

          {latestAudit ? (
            <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1 font-mono text-[6px] uppercase tracking-[0.1em] text-[#69747E]">
              <span>STRUCT {latestAudit.structure ? `${latestAudit.structure.eventType ?? '—'} ${latestAudit.structure.bias}` : '—'}</span>
              <span>LOC {latestAudit.structure?.location ?? '—'} {latestAudit.structure ? `${Math.round(latestAudit.structure.percentile * 100)}%` : ''}</span>
              <span>CYCLE {latestAudit.cycle?.state ?? '—'} · {latestAudit.cycle?.entryTiming ?? '—'}</span>
              <span>4H/1H/15M {latestAudit.cycle ? `${latestAudit.cycle.frames.fourHour}/${latestAudit.cycle.frames.oneHour}/${latestAudit.cycle.frames.fifteenMinute}` : '—'}</span>
              <span>FAMILIES {latestAudit.technicalEvidence ? `${latestAudit.technicalEvidence.bullishFamilies}↑/${latestAudit.technicalEvidence.bearishFamilies}↓/${latestAudit.technicalEvidence.neutralFamilies}·` : '—'}</span>
              <span>CORR PEN {pct(latestAudit.technicalEvidence?.correlatedSignalPenalty)}</span>
              <span>MAP {latestAudit.tradeMap?.status ?? '—'}</span>
              <span>ENTRY {price(latestAudit.tradeMap?.entryPrice)}</span>
              <span>SL {price(latestAudit.tradeMap?.stopLossPrice)}</span>
              <span>TP1 {price(latestAudit.tradeMap?.takeProfit1Price)}</span>
              <span>TP2 {price(latestAudit.tradeMap?.takeProfit2Price)}</span>
            </div>
          ) : (
            <div className="font-mono text-[6px] uppercase tracking-[0.1em] text-[#4F5963]">awaiting audit-rich paper cycle</div>
          )}

          <div className="ml-auto font-mono text-[6px] uppercase tracking-[0.11em] text-[#46515B]">
            shadow evidence · existing execution gates unchanged
          </div>
        </div>
      </div>

      <TradeAuditHistory trades={payload?.recentTrades ?? []} />

      <div className="min-h-0 flex-1">
        <OperationsView />
      </div>
    </div>
  );
};
