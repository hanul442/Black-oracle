import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  Filter,
  GitCommitHorizontal,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';

type Completeness = {
  score: number;
  grade: 'COMPLETE' | 'STRONG' | 'PARTIAL' | 'WEAK';
  passed: number;
  applicable: number;
  missing: string[];
  dimensions: Array<{ id: string; state: 'PASS' | 'MISSING' | 'NOT_APPLICABLE'; reason: string }>;
};

type AuditDecision = {
  cycleNumber: number;
  cycleFinishedAt: number;
  timestamp: number;
  market: string;
  decision: string;
  regime: string | null;
  regimeConfidence: number | null;
  oracleTradeScore: number | null;
  confidence: number | null;
  strategyDisposition: string | null;
  riskDisposition: string | null;
  eventScore: number | null;
  forecast: null | { available: boolean; direction: string; confidence: number; uncertainty: number };
  evidenceState: string;
  evidenceActiveCount: number;
  evidenceContradictionCount: number;
  evidenceIds: string[];
  primaryReason: string | null;
  reasons: string[];
  riskReasons: string[];
  tradeCaseId: string | null;
  councilRunId: string | null;
  intelligencePackageId: string | null;
  auditCompleteness: Completeness;
};

type OperatorLogPayload = {
  success?: boolean;
  available?: boolean;
  error?: string;
  runtimeId?: string;
  checkpointSavedAt?: number;
  cycleCount?: number;
  retainedCycles?: number;
  historyAvailable?: boolean;
  decisions?: AuditDecision[];
  errors?: Array<{ cycleNumber: number; timestamp: number; market: string; error: string }>;
  auditSummary?: {
    averageScore: number;
    complete: number;
    weak: number;
    missingEvidence: number;
    missingCouncil: number;
    missingExecutionTrace: number;
  };
};

const ACTIONS = ['ALL', 'ENTER', 'EXIT', 'HOLD', 'NO_TRADE'] as const;
const GRADES = ['ALL', 'WEAK', 'PARTIAL', 'STRONG', 'COMPLETE'] as const;
const pct = (value: number | null | undefined, digits = 0) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const stamp = (value: number | null | undefined) => value ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '—';

const scoreTone = (score: number) => score >= 90 ? 'text-[#72B6A0]' : score >= 70 ? 'text-[#A9B78B]' : score >= 50 ? 'text-[#C7A96B]' : 'text-[#D66565]';

export const AuditView: React.FC = () => {
  const [payload, setPayload] = useState<OperatorLogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<(typeof ACTIONS)[number]>('ALL');
  const [grade, setGrade] = useState<(typeof GRADES)[number]>('ALL');
  const [market, setMarket] = useState('ALL');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/operator-log?limit=96', { cache: 'no-store' });
      const next = await response.json() as OperatorLogPayload;
      setPayload(next);
      setError(response.ok ? null : next.error || 'Operator audit request failed.');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Operator audit request failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const decisions = payload?.decisions || [];
  const markets = useMemo(() => ['ALL', ...Array.from(new Set(decisions.map((item) => item.market))).sort()], [decisions]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return decisions.filter((item) => {
      if (action !== 'ALL' && item.decision !== action) return false;
      if (grade !== 'ALL' && item.auditCompleteness.grade !== grade) return false;
      if (market !== 'ALL' && item.market !== market) return false;
      if (!needle) return true;
      const haystack = [
        item.market,
        item.decision,
        item.regime || '',
        item.strategyDisposition || '',
        item.riskDisposition || '',
        item.primaryReason || '',
        ...(item.evidenceIds || []),
        ...(item.auditCompleteness.missing || []),
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [action, decisions, grade, market, query]);

  const executionEvents = decisions.filter((item) => item.decision === 'ENTER' || item.decision === 'EXIT').length;
  const lowTraceExecutions = decisions.filter((item) => (item.decision === 'ENTER' || item.decision === 'EXIT') && item.auditCompleteness.score < 70).length;
  const evidenceCoverage = decisions.length ? decisions.filter((item) => item.evidenceActiveCount > 0).length / decisions.length : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-28 pt-5 text-[#E9EDF1] md:px-6 md:pb-20 xl:px-8">
      <div className="mx-auto max-w-[1520px]">
        <header className="border-b border-white/[0.06] pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.22em] text-[#C7A96B]"><GitCommitHorizontal className="h-3.5 w-3.5" />Paper provenance audit</div>
              <h1 className="text-[28px] font-medium tracking-[-0.04em] md:text-[34px]">Audit</h1>
              <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-[#68737D] md:text-xs">Full, uncompressed Paper decision history. Completeness measures whether each decision preserved enough market, strategy, risk, evidence, scenario, Council and execution provenance to reconstruct what happened later.</p>
            </div>
            <button onClick={() => { setLoading(true); void load(); }} className="flex items-center gap-2 self-start border border-white/[0.07] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.13em] text-[#69747E]"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />Refresh audit</button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4 xl:grid-cols-8">
            <HeaderMetric label="RETAINED CYCLES" value={String(payload?.retainedCycles ?? 0)} />
            <HeaderMetric label="DECISIONS" value={String(decisions.length)} />
            <HeaderMetric label="EXECUTION" value={String(executionEvents)} />
            <HeaderMetric label="AUDIT AVG" value={`${payload?.auditSummary?.averageScore ?? 0}%`} warning={(payload?.auditSummary?.averageScore ?? 100) < 70} />
            <HeaderMetric label="WEAK TRACE" value={String(payload?.auditSummary?.weak ?? 0)} warning={(payload?.auditSummary?.weak || 0) > 0} />
            <HeaderMetric label="LOW-TRACE EXEC" value={String(lowTraceExecutions)} warning={lowTraceExecutions > 0} />
            <HeaderMetric label="EVIDENCE COVER" value={pct(evidenceCoverage)} warning={decisions.length > 0 && evidenceCoverage < 0.8} />
            <HeaderMetric label="MISSING COUNCIL" value={String(payload?.auditSummary?.missingCouncil ?? 0)} warning={(payload?.auditSummary?.missingCouncil || 0) > 0} />
          </div>
        </header>

        {error && <div className="mt-4 flex gap-2 border border-[#D66565]/20 bg-[#D66565]/[0.03] p-3 text-[10px] text-[#D69A9A]"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}</div>}
        {!payload?.historyAvailable && payload?.available && <div className="mt-4 flex gap-2 border border-[#C7A96B]/20 bg-[#C7A96B]/[0.025] p-3 text-[10px] text-[#BFA86E]"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Historical retention has not accumulated yet. The deployment currently falls back to the latest persisted cycle.</div>}

        <div className="mt-4 flex flex-col gap-3 border border-white/[0.065] bg-[#070A0E] p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1">{ACTIONS.map((item) => <button key={item} onClick={() => setAction(item)} className={`shrink-0 border px-2.5 py-1.5 font-mono text-[6px] uppercase tracking-[0.12em] ${action === item ? 'border-[#C7A96B]/25 bg-[#C7A96B]/[0.035] text-[#D3BB80]' : 'border-white/[0.06] text-[#53606A]'}`}>{item}</button>)}</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-8 items-center border border-white/[0.06] bg-[#05070A] px-2.5 sm:w-[150px]"><Filter className="mr-2 h-3 w-3 text-[#46515B]" /><select value={grade} onChange={(event) => setGrade(event.target.value as (typeof GRADES)[number])} className="min-w-0 flex-1 bg-transparent font-mono text-[7px] text-[#7B8791] outline-none">{GRADES.map((item) => <option key={item} value={item} className="bg-[#080C11]">{item}</option>)}</select></label>
            <label className="flex h-8 items-center border border-white/[0.06] bg-[#05070A] px-2.5 sm:w-[160px]"><Filter className="mr-2 h-3 w-3 text-[#46515B]" /><select value={market} onChange={(event) => setMarket(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-[7px] text-[#7B8791] outline-none">{markets.map((item) => <option key={item} value={item} className="bg-[#080C11]">{item}</option>)}</select></label>
            <label className="flex h-8 min-w-0 items-center border border-white/[0.06] bg-[#05070A] px-2.5 sm:w-[300px]"><Search className="mr-2 h-3 w-3 text-[#46515B]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="market, reason, evidence, missing link…" className="min-w-0 flex-1 bg-transparent text-[9px] text-[#9DA7B0] outline-none placeholder:text-[#414B54]" /></label>
          </div>
        </div>

        <section className="mt-3 border border-white/[0.065] bg-[#070A0E]">
          <div className="flex items-center justify-between border-b border-white/[0.055] px-3 py-3 md:px-4"><div className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-[#C7A96B]" /><span className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#89949E]">Decision records</span></div><span className="font-mono text-[6px] uppercase text-[#46515B]">{rows.length} shown · checkpoint {stamp(payload?.checkpointSavedAt)}</span></div>
          <div className="divide-y divide-white/[0.045]">
            {rows.map((item) => {
              const id = `${item.cycleNumber}-${item.market}-${item.timestamp}`;
              const open = expanded === id;
              const completeness = item.auditCompleteness;
              const actionTone = item.decision === 'ENTER' ? 'text-[#72B6A0]' : item.decision === 'EXIT' ? 'text-[#C7A96B]' : item.riskDisposition === 'REJECT' ? 'text-[#D66565]' : 'text-[#88939D]';
              return (
                <button key={id} onClick={() => setExpanded(open ? null : id)} className="block w-full px-3 py-3 text-left transition hover:bg-white/[0.012] md:px-4">
                  <div className="flex gap-3">
                    <div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center border ${completeness.score < 50 || item.riskDisposition === 'REJECT' ? 'border-[#D66565]/20 text-[#D66565]' : completeness.score < 80 ? 'border-[#C7A96B]/20 text-[#C7A96B]' : 'border-[#72B6A0]/20 text-[#72B6A0]'}`}>{item.riskDisposition === 'REJECT' ? <ShieldAlert className="h-3 w-3" /> : completeness.score >= 80 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 font-mono text-[6px] uppercase tracking-[0.11em]"><span className="text-[#4E5963]">CYCLE #{item.cycleNumber}</span><span className="text-[#8D98A2]">{item.market}</span><span className={actionTone}>{item.decision}</span><span className="text-[#46515B]">{stamp(item.timestamp)}</span><span className={scoreTone(completeness.score)}>AUDIT {completeness.score}% · {completeness.grade}</span></div>
                          <div className="mt-1.5 text-[10px] leading-relaxed text-[#AEB7BF]">{item.primaryReason || 'No persisted primary reason.'}</div>
                        </div>
                        <ChevronDown className={`mt-1 h-3.5 w-3.5 shrink-0 text-[#46515B] transition ${open ? 'rotate-180' : ''}`} />
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[6px] uppercase tracking-[0.09em] text-[#505B65]"><span>SCORE <b className="font-normal text-[#89949E]">{item.oracleTradeScore ?? '—'}</b></span><span>CONF <b className="font-normal text-[#89949E]">{pct(item.confidence)}</b></span><span>REGIME <b className="font-normal text-[#89949E]">{item.regime || '—'}</b></span><span>ROUTE <b className="font-normal text-[#89949E]">{item.strategyDisposition || '—'}</b></span><span>RISK <b className="font-normal text-[#89949E]">{item.riskDisposition || '—'}</b></span><span>EVIDENCE <b className={item.evidenceState === 'SUPPORTED' ? 'font-normal text-[#72B6A0]' : item.evidenceState === 'CONTESTED' ? 'font-normal text-[#D66565]' : 'font-normal text-[#C7A96B]'}>{item.evidenceActiveCount} · {item.evidenceState}</b></span><span>MISSING <b className="font-normal text-[#B99C69]">{completeness.missing.length ? completeness.missing.length : '0'}</b></span></div>

                      {completeness.missing.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{completeness.missing.map((missing) => <span key={`${id}-${missing}`} className="border border-[#C7A96B]/16 bg-[#C7A96B]/[0.025] px-1.5 py-1 font-mono text-[5px] uppercase tracking-[0.08em] text-[#A88D5F]">{missing}</span>)}</div>}

                      {open && <div className="mt-3 grid gap-3 border-t border-white/[0.045] pt-3 xl:grid-cols-3"><AuditBlock title="DECISION / RISK REASONS" lines={[...(item.reasons || []), ...(item.riskReasons || []).map((reason) => `Risk: ${reason}`)]} /><AuditBlock title="EVIDENCE PROVENANCE" lines={item.evidenceIds.length ? item.evidenceIds : ['No structured evidence ID attached at decision time.']} mono /><div className="border border-white/[0.055] bg-[#05070A] p-3"><div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#59636D]">AUDIT DIMENSIONS</div><div className="mt-2 space-y-2">{completeness.dimensions.map((dimension) => <div key={`${id}-${dimension.id}`} className="flex gap-2"><span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${dimension.state === 'PASS' ? 'bg-[#72B6A0]' : dimension.state === 'MISSING' ? 'bg-[#C7A96B]' : 'bg-[#4A545D]'}`} /><div><div className="font-mono text-[6px] uppercase text-[#7A858F]">{dimension.id} · {dimension.state}</div><div className="mt-0.5 text-[8px] leading-relaxed text-[#59636D]">{dimension.reason}</div></div></div>)}</div>{item.tradeCaseId && <div className="mt-3 border-t border-white/[0.045] pt-2 font-mono text-[6px] text-[#59636D]">CASE {item.tradeCaseId}</div>}</div></div>}
                    </div>
                  </div>
                </button>
              );
            })}
            {!rows.length && <div className="px-5 py-16 text-center"><div className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#59636D]">No matching audit records</div><div className="mt-2 text-[9px] text-[#414B54]">Adjust filters or wait for persisted Paper history.</div></div>}
          </div>
        </section>

        <footer className="mt-3 flex flex-col gap-2 border border-white/[0.06] bg-[#070A0E] p-3 font-mono text-[6px] uppercase tracking-[0.1em] text-[#4E5963] sm:flex-row sm:items-center sm:justify-between"><span>runtime {payload?.runtimeId || '—'} · total cycle count {payload?.cycleCount ?? '—'}</span><span>{payload?.auditSummary?.missingEvidence ?? 0} missing evidence · {payload?.auditSummary?.missingExecutionTrace ?? 0} missing execution trace</span></footer>
      </div>
    </div>
  );
};

const HeaderMetric = ({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) => <div className="bg-[#070A0E] px-3 py-3"><div className="font-mono text-[5px] uppercase tracking-[0.14em] text-[#46515B]">{label}</div><div className={`mt-1 font-mono text-[10px] tabular-nums ${warning ? 'text-[#C7A96B]' : 'text-[#AEB7BF]'}`}>{value}</div></div>;

const AuditBlock = ({ title, lines, mono = false }: { title: string; lines: string[]; mono?: boolean }) => <div className="border border-white/[0.055] bg-[#05070A] p-3"><div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#59636D]">{title}</div><div className={`mt-2 space-y-1.5 text-[9px] leading-relaxed text-[#77818B] ${mono ? 'font-mono text-[7px]' : ''}`}>{lines.length ? lines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : <div>None persisted.</div>}</div></div>;
