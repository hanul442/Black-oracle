import React, { useCallback, useEffect, useState } from 'react';
import { Activity, GitCompareArrows, ShieldAlert } from 'lucide-react';

type Verdict = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';
type ResearchPayload = {
  available?: boolean;
  sampleBasis?: { closedTrades: number; blindValidationSamples: number; councilComparisonSamples: number; resolvedCouncilComparisons: number };
  expectedShortfall?: {
    es95?: { available: boolean; valueAtRisk: number | null; expectedShortfall: number | null };
    es99?: { available: boolean; valueAtRisk: number | null; expectedShortfall: number | null };
  };
  deflatedSharpe?: { verdict: Verdict; probability: number | null; sharpePerObservation: number | null; trialCount: number; trialCountSource: string };
  probabilityBacktestOverfitting?: { verdict: Verdict; pbo: number | null; strategyCount: number; source?: string; note?: string };
  blockRegimeMonteCarlo?: { verdict: Verdict; survivalProbability: number | null; drawdownP95: number | null; expectedShortfall95: number | null; regimeCount: number; sampleCount: number };
  councilComparison?: { resolved: number; disagreements: number; v1FavorableRate: number | null; v2FavorableRate: number | null; v1DirectionalBrierProxy: number | null; v2DirectionalBrierProxy: number | null; v2WinRateOnDisagreement: number | null; recommendation: string };
  forecastCalibration?: {
    v1?: { verdict: Verdict; sampleCount: number; brierScore: number | null; expectedCalibrationError: number | null };
    v2?: { verdict: Verdict; sampleCount: number; brierScore: number | null; expectedCalibrationError: number | null };
  };
};

const pct = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const num = (value: number | null | undefined, digits = 3) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);
const verdictTone = (value?: string) => value === 'PASS' ? 'text-[#72B6A0]' : value === 'REJECT' ? 'text-[#D66565]' : value === 'WATCH' ? 'text-[#C7A96B]' : 'text-[#69747E]';

export const ResearchValidationPanel: React.FC = () => {
  const [payload, setPayload] = useState<ResearchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/trading-research-validation', { cache: 'no-store' });
      const next = await response.json() as ResearchPayload & { error?: string };
      if (!response.ok) setError(next.error || 'Research validation unavailable.');
      else { setPayload(next); setError(null); }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Research validation unavailable.');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const comparison = payload?.councilComparison;
  const block = payload?.blockRegimeMonteCarlo;
  const dsr = payload?.deflatedSharpe;
  const pbo = payload?.probabilityBacktestOverfitting;
  const v1Cal = payload?.forecastCalibration?.v1;
  const v2Cal = payload?.forecastCalibration?.v2;

  return (
    <section className="mt-3 border border-white/[0.065] bg-[#070A0E]">
      <div className="flex flex-col gap-2 border-b border-white/[0.055] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><Activity className="h-3 w-3 text-[#C7A96B]" /><span className="font-mono text-[7px] uppercase tracking-[0.14em] text-[#89949E]">Research Validation v2</span></div>
        <span className="font-mono text-[6px] uppercase tracking-[0.1em] text-[#4F5963]">selection bias · tail risk · regime stress · calibration · challenger comparison</span>
      </div>
      {error && <div className="border-b border-[#D66565]/20 px-3 py-2 text-[8px] text-[#D69A9A]">{error}</div>}

      <div className="grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4 xl:grid-cols-8">
        <RMetric label="DSR" value={dsr?.verdict || '—'} tone={verdictTone(dsr?.verdict)} />
        <RMetric label="DSR PROB" value={pct(dsr?.probability)} />
        <RMetric label="PBO" value={pbo?.verdict || '—'} tone={verdictTone(pbo?.verdict)} />
        <RMetric label="PBO EST" value={pct(pbo?.pbo)} />
        <RMetric label="BLOCK MC" value={block?.verdict || '—'} tone={verdictTone(block?.verdict)} />
        <RMetric label="SURVIVAL" value={pct(block?.survivalProbability)} />
        <RMetric label="ES95" value={pct(payload?.expectedShortfall?.es95?.expectedShortfall)} danger={(payload?.expectedShortfall?.es95?.expectedShortfall ?? 0) < -0.05} />
        <RMetric label="COUNCIL CMP" value={comparison?.recommendation || '—'} tone={comparison?.recommendation === 'V2_PROMOTION_CANDIDATE' ? 'text-[#72B6A0]' : comparison?.recommendation === 'KEEP_V1' ? 'text-[#C7A96B]' : 'text-[#69747E]'} />
      </div>

      <div className="grid gap-px bg-white/[0.04] xl:grid-cols-3">
        <div className="bg-[#070A0E] p-3">
          <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#59636D]">Selection bias / tail risk</div>
          <div className="mt-2 grid grid-cols-2 gap-px bg-white/[0.04]">
            <Mini label="Sharpe / obs" value={num(dsr?.sharpePerObservation, 4)} />
            <Mini label="Trials" value={dsr ? `${dsr.trialCount} · ${dsr.trialCountSource}` : '—'} />
            <Mini label="VaR 95" value={pct(payload?.expectedShortfall?.es95?.valueAtRisk)} />
            <Mini label="ES 99" value={pct(payload?.expectedShortfall?.es99?.expectedShortfall)} />
          </div>
          <div className="mt-2 flex items-start gap-2 text-[8px] leading-relaxed text-[#56616B]"><ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" /><span>{pbo?.note || 'PBO activates only when aligned return panels for multiple strategy candidates exist.'}</span></div>
        </div>

        <div className="bg-[#070A0E] p-3">
          <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#59636D]">Block / regime stress</div>
          <div className="mt-2 grid grid-cols-2 gap-px bg-white/[0.04]">
            <Mini label="Samples" value={String(block?.sampleCount ?? 0)} />
            <Mini label="Regimes" value={String(block?.regimeCount ?? 0)} />
            <Mini label="P95 DD" value={pct(block?.drawdownP95)} />
            <Mini label="Terminal ES95" value={pct(block?.expectedShortfall95)} />
          </div>
          <p className="mt-2 text-[8px] leading-relaxed text-[#56616B]">Moving blocks remain inside observed regimes before scenario recombination. This is a stress model, not proof of future stationarity.</p>
        </div>

        <div className="bg-[#070A0E] p-3">
          <div className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.12em] text-[#59636D]"><GitCompareArrows className="h-3 w-3" />Council v1 vs v2 prospective ledger</div>
          <div className="mt-2 grid grid-cols-2 gap-px bg-white/[0.04]">
            <Mini label="Resolved" value={String(comparison?.resolved ?? 0)} />
            <Mini label="Disagree" value={String(comparison?.disagreements ?? 0)} />
            <Mini label="V1 favorable" value={pct(comparison?.v1FavorableRate)} />
            <Mini label="V2 favorable" value={pct(comparison?.v2FavorableRate)} />
            <Mini label="V1 Brier" value={num(v1Cal?.brierScore)} />
            <Mini label="V2 Brier" value={num(v2Cal?.brierScore)} />
            <Mini label="V1 ECE" value={pct(v1Cal?.expectedCalibrationError)} />
            <Mini label="V2 ECE" value={pct(v2Cal?.expectedCalibrationError)} />
          </div>
          <p className="mt-2 text-[8px] leading-relaxed text-[#56616B]">V2 disagreement win rate {pct(comparison?.v2WinRateOnDisagreement)}. A promotion-candidate label never grants execution or promotion authority.</p>
        </div>
      </div>

      <div className="border-t border-white/[0.05] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.09em] text-[#46515B]">
        closed trades {payload?.sampleBasis?.closedTrades ?? 0} · blind samples {payload?.sampleBasis?.blindValidationSamples ?? 0} · council observations {payload?.sampleBasis?.councilComparisonSamples ?? 0} · resolved {payload?.sampleBasis?.resolvedCouncilComparisons ?? 0}
      </div>
    </section>
  );
};

const RMetric = ({ label, value, tone, danger = false }: { label: string; value: string; tone?: string; danger?: boolean }) => <div className="bg-[#070A0E] p-2.5"><div className="font-mono text-[6px] uppercase tracking-[0.1em] text-[#4F5963]">{label}</div><div className={`mt-1 font-mono text-[9px] ${tone || (danger ? 'text-[#D66565]' : 'text-[#AAB3BC]')}`}>{value}</div></div>;
const Mini = ({ label, value }: { label: string; value: string }) => <div className="bg-[#05080C] p-2"><div className="font-mono text-[5.5px] uppercase tracking-[0.09em] text-[#46515B]">{label}</div><div className="mt-1 font-mono text-[8px] text-[#909AA2]">{value}</div></div>;
