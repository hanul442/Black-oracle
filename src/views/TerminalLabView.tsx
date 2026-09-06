import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { EmpiricalValidationStrip } from '../components/EmpiricalValidationStrip';

type Status = any;
type Readiness = any;

const pct = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const verdictTone = (value?: string) => value === 'PASS' ? 'text-[#62d49f]' : value === 'REJECT' ? 'text-[#ff6262]' : 'text-[#f3b642]';

export const TerminalLabView: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const errors: string[] = [];
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      const next = await response.json();
      setStatus(next);
      if (!response.ok) errors.push(next?.error || 'Validation status request failed.');
    } catch (nextError) {
      errors.push(nextError instanceof Error ? nextError.message : 'Validation status request failed.');
    }
    try {
      const response = await fetch('/api/trading-readiness', { cache: 'no-store' });
      const next = await response.json();
      setReadiness(next);
      if (!response.ok) errors.push(next?.error || 'Readiness request failed.');
    } catch (nextError) {
      errors.push(nextError instanceof Error ? nextError.message : 'Readiness request failed.');
    }
    setError(errors.length ? errors.join(' · ') : null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const hist = status?.historicalValidation;
  const wf = status?.walkForwardValidation;
  const mc = status?.validation;
  const integrity = status?.integrity;
  const eligibility = status?.liveEligibility;
  const audit = status?.promotionAudit;
  const preflight = readiness?.deploymentPreflight;
  const evidenceReady = readiness?.evidenceRefresh;

  return (
    <div className="terminal-screen h-full overflow-hidden bg-[#030405] text-[#d9dde1]">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-3 border-b border-[#24282c] bg-[#070809] px-3 font-mono text-[7px] uppercase tracking-[0.08em]">
          <span className="text-[#f3a312]">LAB</span>
          <span className="text-[#59636b]">BLIND <b className={`font-normal ${verdictTone(hist?.verdict)}`}>{hist?.verdict || '—'}</b></span>
          <span className="text-[#59636b]">WF <b className={`font-normal ${verdictTone(wf?.verdict)}`}>{wf?.verdict || '—'}</b></span>
          <span className="text-[#59636b]">MC <b className={`font-normal ${verdictTone(mc?.verdict)}`}>{mc?.verdict || '—'}</b></span>
          <span className="text-[#59636b]">SAMPLES <b className="font-normal text-[#c4cbd1]">{hist?.sampleCount ?? 0}</b></span>
          <span className="text-[#59636b]">DAYS <b className="font-normal text-[#c4cbd1]">{hist?.observationDays?.toFixed?.(1) ?? '—'}</b></span>
          <span className="text-[#59636b]">EVID COVER <b className="font-normal text-[#c4cbd1]">{pct(audit?.evidenceCoverage)}</b></span>
          <span className="text-[#59636b]">AUDIT <b className="font-normal text-[#c4cbd1]">{pct(audit?.auditAverage)}</b></span>
          {error && <span className="truncate text-[#ff6262]">{error}</span>}
          <button onClick={() => { setLoading(true); void load(); }} className="terminal-action ml-auto"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />REFRESH</button>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-[#24282c] bg-[#24282c] sm:grid-cols-4 xl:grid-cols-8">
          <Metric label="HIST VERDICT" value={hist?.verdict || '—'} warn={hist?.verdict !== 'PASS'} />
          <Metric label="WF VERDICT" value={wf?.verdict || '—'} warn={wf?.verdict !== 'PASS'} />
          <Metric label="MC VERDICT" value={mc?.verdict || '—'} warn={mc?.verdict !== 'PASS'} />
          <Metric label="MC SURVIVAL" value={pct(mc?.survivalProbability)} warn={mc?.verdict !== 'PASS'} />
          <Metric label="MC RUIN" value={pct(mc?.ruinProbability)} warn={(mc?.ruinProbability || 0) > 0} />
          <Metric label="INTEGRITY" value={`${integrity?.coverageDays?.toFixed?.(1) ?? 0}/${integrity?.requiredCoverageDays ?? 14}d`} warn={!integrity?.coverageComplete} />
          <Metric label="INCIDENTS" value={String(integrity?.totalIncidents ?? 0)} warn={(integrity?.totalIncidents || 0) > 0} />
          <Metric label="LIVE GATE" value={eligibility?.state || 'BLOCKED'} warn={eligibility?.eligibleForLiveExecution !== true} />
        </div>

        <EmpiricalValidationStrip />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-[#24282c] xl:grid-cols-[1.1fr_1fr_.85fr]">
          <section className="min-h-0 overflow-auto bg-[#050607]">
            <SectionTitle n="1" title="VALIDATION MATRIX" />
            <div className="p-2 font-mono">
              <Panel title="HISTORICAL / BLIND">
                <KeyRows rows={[
                  ['VERDICT', hist?.verdict || '—'],
                  ['SAMPLES', String(hist?.sampleCount ?? 0)],
                  ['OBS DAYS', hist?.observationDays?.toFixed?.(2) ?? '—'],
                  ['FAVORABLE', pct(hist?.favorableRate)],
                  ['MEAN DIR RET', pct(hist?.meanDirectionalReturn)],
                ]} />
                <ReasonList items={hist?.reasons || []} />
              </Panel>

              <div className="mt-2 border border-[#20252a] bg-[#070809]">
                <div className="grid grid-cols-[110px_70px_90px_1fr] border-b border-[#20252a] px-2 py-1.5 text-[6px] uppercase tracking-[0.08em] text-[#59636b]"><span>REGIME</span><span>N</span><span>FAVORABLE</span><span>MEAN RETURN</span></div>
                {(hist?.byRegime || []).map((item: any) => <div key={item.regime} className="grid grid-cols-[110px_70px_90px_1fr] border-b border-[#15191c] px-2 py-1.5 text-[7px]"><span className="text-[#b9c0c6]">{item.regime}</span><span>{item.samples}</span><span>{pct(item.favorableRate)}</span><span>{pct(item.meanDirectionalReturn)}</span></div>)}
              </div>

              <div className="mt-2 border border-[#20252a] bg-[#070809]">
                <div className="grid grid-cols-[58px_68px_84px_1fr_86px] border-b border-[#20252a] px-2 py-1.5 text-[6px] uppercase tracking-[0.08em] text-[#59636b]"><span>FOLD</span><span>N</span><span>FAV</span><span>MEAN RETURN</span><span>VERDICT</span></div>
                {(wf?.folds || []).map((item: any) => <div key={item.fold} className="grid grid-cols-[58px_68px_84px_1fr_86px] border-b border-[#15191c] px-2 py-1.5 text-[7px]"><span>#{item.fold}</span><span>{item.samples}</span><span>{pct(item.favorableRate)}</span><span>{pct(item.meanDirectionalReturn)}</span><span className={verdictTone(item.verdict)}>{item.verdict}</span></div>)}
              </div>
            </div>
          </section>

          <section className="min-h-0 overflow-auto bg-[#050607]">
            <SectionTitle n="2" title="PROMOTION / INTEGRITY" />
            <div className="space-y-2 p-2 font-mono">
              <Panel title="LIVE ELIGIBILITY">
                <div className={`mb-2 text-[9px] ${eligibility?.eligibleForLiveExecution ? 'text-[#62d49f]' : 'text-[#f3b642]'}`}>{eligibility?.state || 'BLOCKED'}</div>
                <div className="space-y-1">{(eligibility?.gates || []).map((gate: any) => <div key={gate.id} className="grid grid-cols-[18px_120px_1fr] gap-2 border-b border-[#15191c] pb-1 text-[6.5px]"><span className={gate.passed ? 'text-[#62d49f]' : 'text-[#ff6262]'}>{gate.passed ? '✓' : '×'}</span><span className="text-[#879199]">{gate.id}</span><span className="text-[#a9b0b6]">{gate.actual} / req {gate.required}</span></div>)}</div>
                <ReasonList items={eligibility?.blockers || []} />
              </Panel>

              <Panel title="INTEGRITY LEDGER">
                <KeyRows rows={[
                  ['COVERAGE', `${integrity?.coverageDays?.toFixed?.(2) ?? 0}/${integrity?.requiredCoverageDays ?? 14}d`],
                  ['COMPLETE', integrity?.coverageComplete ? 'YES' : 'NO'],
                  ['INCIDENTS', String(integrity?.totalIncidents ?? 0)],
                  ['DAILY RISK', String(integrity?.dailyRiskBreaches ?? '—')],
                  ['RISK BYPASS', String(integrity?.riskBypasses ?? '—')],
                  ['EXEC VIOL', String(integrity?.executionIntegrityViolations ?? '—')],
                  ['FATAL', String(integrity?.fatalRuntimeIncidents ?? '—')],
                  ['UNRESOLVED', String(integrity?.unresolvedCriticalIncidents ?? '—')],
                ]} />
              </Panel>

              <Panel title="PROMOTION AUDIT">
                <KeyRows rows={[
                  ['EVID COVER', pct(audit?.evidenceCoverage)],
                  ['NO-EVID ENTRY', String(audit?.evidenceLessEntries ?? 0)],
                  ['AUDIT AVG', pct(audit?.auditAverage)],
                  ['WEAK EXEC', String(audit?.weakExecutions ?? 0)],
                  ['LEGACY UNLINK', String(audit?.legacyUnlinkedEntries ?? 0)],
                  ['REGIME ROBUST', audit?.regimeRobustnessPass ? 'PASS' : 'FAIL'],
                  ['COST STRESS', audit?.costStressPass ? 'PASS' : 'FAIL'],
                ]} />
              </Panel>
            </div>
          </section>

          <section className="min-h-0 overflow-auto bg-[#050607]">
            <SectionTitle n="3" title="READINESS / SCHEDULER" />
            <div className="space-y-2 p-2 font-mono">
              <Panel title="EVIDENCE REFRESH">
                <KeyRows rows={[
                  ['SUPABASE', evidenceReady?.persistenceSupabase ? 'YES' : 'NO'],
                  ['URL CONFIG', evidenceReady?.supabaseUrlConfigured ? 'YES' : 'NO'],
                  ['SERVICE ROLE', evidenceReady?.serviceRoleConfigured ? 'YES' : 'NO'],
                  ['CLASSIFIER', evidenceReady?.classifierConfigured ? 'YES' : 'NO'],
                  ['READY', evidenceReady?.ready ? 'YES' : 'NO'],
                  ['MISSING', (evidenceReady?.missing || []).join(', ') || 'none'],
                ]} />
              </Panel>

              <Panel title="DEPLOYMENT PREFLIGHT">
                <KeyRows rows={[
                  ['ENV', preflight?.environmentReady ? 'PASS' : 'FAIL'],
                  ['RUNTIME DB', preflight?.supabaseRuntimeReachable ? 'PASS' : 'FAIL'],
                  ['CHECKPOINT', preflight?.runtimeCheckpointPresent ? 'PASS' : 'FAIL'],
                  ['SCHEDULER DB', preflight?.supabaseSchedulerReachable ? 'PASS' : 'FAIL'],
                  ['CONFIG', preflight?.schedulerConfigPresent ? 'PASS' : 'FAIL'],
                  ['ENABLED', preflight?.schedulerEnabled ? 'YES' : 'NO'],
                  ['PROD TARGET', preflight?.schedulerTargetProduction ? 'PASS' : 'FAIL'],
                  ['PREVIEW', preflight?.readyForPaperPreview ? 'READY' : 'BLOCKED'],
                  ['PRODUCTION', preflight?.readyForProductionPaperRollout ? 'READY' : 'BLOCKED'],
                ]} />
                <ReasonList items={preflight?.blockers || []} />
              </Panel>

              <Panel title="SCHEDULER POLICY">
                <KeyRows rows={[
                  ['ORDER', (readiness?.scheduler?.expectedOrder || []).join(' → ') || '—'],
                  ['EVID TIMEOUT', readiness?.scheduler?.evidenceTimeoutMs == null ? '—' : `${readiness.scheduler.evidenceTimeoutMs / 1000}s`],
                  ['PAPER TIMEOUT', readiness?.scheduler?.paperCycleTimeoutMs == null ? '—' : `${readiness.scheduler.paperCycleTimeoutMs / 1000}s`],
                  ['BUDGET', readiness?.scheduler?.downstreamBudgetMs == null ? '—' : `${readiness.scheduler.downstreamBudgetMs / 1000}s`],
                  ['EXIT AUTH', readiness?.scheduler?.protectiveExitAuthority ? 'YES' : 'NO'],
                  ['DEPLOY AUTH', readiness?.scheduler?.deploymentAuthority ? 'YES' : 'NO'],
                ]} />
              </Panel>
            </div>
          </section>
        </div>

        <div className="flex h-5 shrink-0 items-center justify-between border-t border-[#24282c] bg-[#070809] px-2.5 font-mono text-[6px] uppercase tracking-[0.08em] text-[#505960]">
          <span>validation only · no exchange authority · human approval mandatory</span>
          <span>{status?.governance?.policy || 'STRICT_CONSENSUS'}</span>
        </div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) => <div className="bg-[#070809] px-2.5 py-2 font-mono"><div className="text-[5.5px] uppercase tracking-[0.08em] text-[#59636b]">{label}</div><div className={`mt-1 text-[9px] ${warn ? 'text-[#f3b642]' : 'text-[#cbd1d6]'}`}>{value}</div></div>;
const SectionTitle = ({ n, title }: { n: string; title: string }) => <div className="flex h-7 items-center border-b border-[#202429] px-2.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[#717b84]"><b className="mr-2 font-normal text-[#f3a312]">{n}</b>{title}</div>;
const Panel = ({ title, children }: React.PropsWithChildren<{ title: string }>) => <section className="border border-[#20252a] bg-[#070809]"><div className="border-b border-[#20252a] px-2 py-1.5 text-[6px] uppercase tracking-[0.08em] text-[#59636b]">{title}</div><div className="p-2">{children}</div></section>;
const KeyRows = ({ rows }: { rows: Array<[string, string]> }) => <div className="space-y-1">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 border-b border-[#15191c] pb-1 text-[6.5px]"><span className="text-[#626c74]">{label}</span><span className="break-all text-[#aab2b8]">{value}</span></div>)}</div>;
const ReasonList = ({ items }: { items: string[] }) => items.length ? <div className="mt-2 border-t border-[#181c20] pt-2 text-[6.5px] leading-4 text-[#7e8890]">{items.map((item, index) => <div key={`${item}-${index}`}>· {item}</div>)}</div> : null;
