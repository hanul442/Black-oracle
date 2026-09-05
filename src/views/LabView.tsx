import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { InteractiveEquityPanel } from '../components/InteractiveEquityPanel';
import { RiskLabPanel } from '../components/RiskLabPanel';

type Verdict = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';
type LabStatus = {
  available?: boolean;
  historicalValidation?: {
    verdict: Verdict;
    sampleCount: number;
    observationDays: number;
    favorableRate: number | null;
    meanDirectionalReturn: number | null;
    reasons: string[];
    byRegime: Array<{ regime: string; samples: number; favorableRate: number; meanDirectionalReturn: number }>;
  };
  walkForwardValidation?: {
    verdict: Verdict;
    positiveFoldRate: number | null;
    folds: Array<{ fold: number; samples: number; favorableRate: number | null; meanDirectionalReturn: number | null; verdict: Verdict }>;
    reasons: string[];
  };
  liveEligibility?: {
    state: string;
    eligibleForLiveExecution: false;
    stageNotionalKrw: number | null;
    blockers: string[];
    gates: Array<{ id: string; passed: boolean; actual: string; required: string }>;
    reasons: string[];
  };
  promotionAudit?: {
    evidenceCoverage: number;
    evidenceLessEntries: number;
    auditAverage: number;
    weakExecutions: number;
    legacyUnlinkedEntries: number;
    regimeRobustnessPass: boolean;
    costStressPass: boolean;
  };
  governance?: { mode: string; policy: string; engine: string; protectiveExitAuthority: boolean; entryRule: string };
};

const pct = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const verdictTone = (value?: string) => value === 'PASS' ? 'text-[#72B6A0]' : value === 'REJECT' ? 'text-[#D66565]' : 'text-[#C7A96B]';

export const LabView: React.FC = () => {
  const [status, setStatus] = useState<LabStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      const payload = await response.json() as LabStatus & { error?: string };
      setStatus(payload);
      setError(response.ok ? null : payload.error || 'Validation status request failed.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Validation status request failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] pb-28 text-[#E9EDF1] md:pb-20">
      <div className="mx-auto max-w-[1520px] px-4 pt-5 md:px-6 xl:px-8">
        <header className="mb-4 flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.22em] text-[#C7A96B]"><FlaskConical className="h-3.5 w-3.5" /> Validation & experiment workspace</div>
            <h1 className="text-[28px] font-medium tracking-[-0.04em] md:text-[34px]">Lab</h1>
            <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-[#68737D] md:text-xs">Historical no-lookahead evidence, walk-forward folds, Monte Carlo, portfolio risk and promotion governance are inspected here. Lab output never has exchange order authority.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 border border-[#72B6A0]/20 bg-[#72B6A0]/[0.025] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.12em] text-[#7DB6A4]"><ShieldCheck className="h-3 w-3" /> Human approval required</div>
            <button onClick={() => { setLoading(true); void load(); }} className="flex items-center gap-2 border border-white/[0.07] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.12em] text-[#68737D]"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          </div>
        </header>

        {error && <div className="mb-4 flex gap-2 border border-[#D66565]/20 bg-[#D66565]/[0.03] p-3 text-[10px] text-[#D69A9A]"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}</div>}

        <section className="mb-4 border border-white/[0.065] bg-[#070A0E]">
          <div className="flex flex-col gap-2 border-b border-white/[0.055] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div><div className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#89949E]">Promotion control plane</div><div className="mt-1 text-[9px] text-[#56616B]">PAPER → evidence-governed validation → human-approved 300K candidate stage</div></div>
            <span className={`font-mono text-[8px] uppercase ${status?.liveEligibility?.state === 'SMALL_LIVE_CANDIDATE' || status?.liveEligibility?.state === 'APPROVED_STAGE_300K' ? 'text-[#72B6A0]' : 'text-[#C7A96B]'}`}>{status?.liveEligibility?.state || 'UNAVAILABLE'}</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/[0.04] md:grid-cols-4 xl:grid-cols-8">
            <Metric label="BLIND" value={status?.historicalValidation?.verdict || '—'} tone={verdictTone(status?.historicalValidation?.verdict)} />
            <Metric label="WF" value={status?.walkForwardValidation?.verdict || '—'} tone={verdictTone(status?.walkForwardValidation?.verdict)} />
            <Metric label="SAMPLES" value={String(status?.historicalValidation?.sampleCount ?? 0)} />
            <Metric label="DAYS" value={status?.historicalValidation ? status.historicalValidation.observationDays.toFixed(1) : '—'} />
            <Metric label="EVIDENCE" value={pct(status?.promotionAudit?.evidenceCoverage)} warning={(status?.promotionAudit?.evidenceCoverage ?? 0) < 0.95} />
            <Metric label="AUDIT" value={pct(status?.promotionAudit?.auditAverage)} warning={(status?.promotionAudit?.auditAverage ?? 0) < 0.9} />
            <Metric label="WEAK EXEC" value={String(status?.promotionAudit?.weakExecutions ?? 0)} warning={(status?.promotionAudit?.weakExecutions ?? 0) > 0} />
            <Metric label="BLOCKERS" value={String(status?.liveEligibility?.blockers?.length ?? 0)} warning={(status?.liveEligibility?.blockers?.length ?? 0) > 0} />
          </div>

          <div className="grid gap-px bg-white/[0.04] lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-[#070A0E] p-4">
              <div className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#59636D]">LIVE ELIGIBILITY GATES</div>
              <div className="mt-3 grid gap-1 sm:grid-cols-2">
                {(status?.liveEligibility?.gates || []).map((gate) => <div key={gate.id} className="flex items-start gap-2 border border-white/[0.05] bg-[#05070A] px-2.5 py-2">
                  {gate.passed ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#72B6A0]" /> : <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-[#D66565]" />}
                  <div className="min-w-0"><div className="font-mono text-[6px] uppercase text-[#7C8791]">{gate.id}</div><div className="mt-1 text-[8px] text-[#535F69]">{gate.actual} · required {gate.required}</div></div>
                </div>)}
                {!status?.liveEligibility?.gates?.length && <div className="text-[9px] text-[#4A555E]">Promotion gates unavailable.</div>}
              </div>
            </div>
            <div className="bg-[#070A0E] p-4">
              <div className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#59636D]">STRICT GOVERNANCE</div>
              <div className="mt-3 space-y-2 text-[9px] leading-relaxed text-[#68737D]">
                <p><span className="font-mono text-[7px] text-[#C7A96B]">{status?.governance?.policy || 'STRICT_CONSENSUS'}</span> · {status?.governance?.entryRule || 'Evidence + Scenario/Council + Risk required before new entry.'}</p>
                <p>Protective exit authority: <span className={status?.governance?.protectiveExitAuthority ? 'text-[#72B6A0]' : 'text-[#D66565]'}>{status?.governance?.protectiveExitAuthority ? 'PRESERVED' : 'UNKNOWN'}</span>.</p>
                <p>Strategy Factory Alpha can generate, reject, incubate and rank Challengers, but there is no automatic Champion or live deployment state.</p>
                {(status?.liveEligibility?.reasons || []).map((reason) => <p key={reason}>• {reason}</p>)}
              </div>
            </div>
          </div>
        </section>
      </div>

      <RiskLabPanel />
      <InteractiveEquityPanel />

      <div className="mx-auto max-w-[1520px] px-4 pb-8 md:px-6 xl:px-8">
        <section className="border border-white/[0.065] bg-[#070A0E] p-4">
          <div className="font-mono text-[6px] uppercase tracking-[0.15em] text-[#59636D]">Experiment governance boundary</div>
          <div className="mt-3 grid gap-px bg-white/[0.04] sm:grid-cols-3">
            <LabBoundary title="FACTORY ALPHA" detail="Seeded Genome mutation is bounded by hard risk limits; failed Blind/WF/MC/Evidence/Audit/Cost gates are rejected before tournament." />
            <LabBoundary title="CHALLENGER" detail="Tournament winners can become Challengers only. No candidate can create a Champion or order authority automatically." />
            <LabBoundary title="PROMOTION" detail="Live eligibility stays blocked on unavailable incident/integrity evidence and still requires explicit human approval." />
          </div>
        </section>
      </div>
    </div>
  );
};

const Metric = ({ label, value, warning, tone }: { label: string; value: string; warning?: boolean; tone?: string }) => <div className="bg-[#070A0E] p-3"><div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5A64]">{label}</div><div className={`mt-1.5 font-mono text-[13px] ${tone || (warning ? 'text-[#C7A96B]' : 'text-[#AAB3BB]')}`}>{value}</div></div>;
const LabBoundary = ({ title, detail }: { title: string; detail: string }) => <div className="bg-[#070A0E] p-4"><div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#C7A96B]">{title}</div><p className="mt-2 text-[9px] leading-relaxed text-[#68737D]">{detail}</p></div>;
