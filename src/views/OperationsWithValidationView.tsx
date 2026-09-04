import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { InteractiveEquityPanel } from '../components/InteractiveEquityPanel';
import { PositionEvidencePanel } from '../components/PositionEvidencePanel';
import { RiskLabPanel } from '../components/RiskLabPanel';
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

type StatusPayload = {
  success?: boolean;
  available?: boolean;
  validation?: Validation;
};

const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—'
  : `${(value * 100).toFixed(1)}%`;

const toneFor = (verdict: Validation['verdict'] | undefined) => {
  if (verdict === 'PASS') return 'border-[#72B6A0]/20 bg-[#72B6A0]/[0.035] text-[#86C5B1]';
  if (verdict === 'REJECT') return 'border-[#D66565]/20 bg-[#D66565]/[0.035] text-[#D98787]';
  if (verdict === 'WATCH') return 'border-[#C7A96B]/20 bg-[#C7A96B]/[0.035] text-[#D3B778]';
  return 'border-white/[0.07] bg-[#080C11] text-[#7E8993]';
};

export const OperationsWithValidationView: React.FC = () => {
  const [validation, setValidation] = useState<Validation | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/trading-status', { cache: 'no-store' });
        const payload = await response.json() as StatusPayload;
        if (!cancelled) setValidation(payload.validation ?? null);
      } catch {
        if (!cancelled) setValidation(null);
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const verdict = validation?.verdict ?? 'INSUFFICIENT_DATA';
  const minimumTrades = 20;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#05070A]">
      <div className={`shrink-0 border-b px-4 py-2.5 md:px-6 xl:px-8 ${toneFor(verdict)}`}>
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="font-mono text-[7px] uppercase tracking-[0.18em]">Account-normalized Monte Carlo</span>
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
            conservative reference · validation only · no order authority
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PositionEvidencePanel />
        <InteractiveEquityPanel />
        <RiskLabPanel />
        <div className="min-h-[calc(100%-1px)]">
          <OperationsView />
        </div>
      </div>
    </div>
  );
};
