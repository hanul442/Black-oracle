import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Database,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  SquareTerminal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

type EventKind = 'ALL' | 'CYCLE' | 'DECISION' | 'RISK' | 'EVIDENCE' | 'TRADE' | 'SYSTEM';
type Severity = 'critical' | 'warning' | 'normal' | 'info';

type AuditCompleteness = {
  score: number;
  grade: 'COMPLETE' | 'STRONG' | 'PARTIAL' | 'WEAK';
  passed: number;
  applicable: number;
  missing: string[];
  dimensions?: Array<{ id: string; state: string; reason: string }>;
};

type Decision = {
  cycleNumber?: number;
  timestamp: number;
  market: string;
  decision: string;
  regime?: string | null;
  oracleTradeScore?: number | null;
  confidence?: number | null;
  strategyDisposition?: string | null;
  riskDisposition?: string | null;
  forecast?: null | { available: boolean; direction: string; confidence: number };
  evidenceState?: string;
  evidenceActiveCount?: number;
  evidenceContradictionCount?: number;
  evidenceIds?: string[];
  primaryReason?: string | null;
  reasons?: string[];
  riskReasons?: string[];
  repeatCount?: number;
  firstCycleNumber?: number;
  lastCycleNumber?: number;
  firstTimestamp?: number;
  lastTimestamp?: number;
  tradeCaseId?: string | null;
  councilRunId?: string | null;
  auditCompleteness?: AuditCompleteness;
};

type TradingStatus = {
  available?: boolean;
  status?: string;
  now?: number;
  mode?: string;
  error?: string;
  checkpoint?: { savedAt: number; reason: string; backend: string; runtimeId?: string };
  loop?: {
    cycleCount: number;
    ageMs: number | null;
    stale: boolean;
    lastCycle: null | {
      startedAt: number;
      finishedAt: number;
      durationMs: number;
      scanned: number;
      entered: number;
      exited: number;
      held: number;
      noTrade?: number;
      errors: Array<{ market: string; error: string }>;
    };
  };
  portfolio?: {
    equity: number;
    dailyPnlPct: number;
    currentDrawdownPct: number;
    openPositions: Array<{ market: string }>;
  };
  performance?: { totalReturnPct: number; maxDrawdownPct: number; trades: number; winRate: number };
  ingestion?: { evidenceActive: number; lastCycleErrors: number };
  validation?: {
    verdict: 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';
    tradeCount: number;
    survivalProbability: number | null;
    ruinProbability: number | null;
    maxDrawdown: { p95: number | null };
    reasons: string[];
  };
  positionEvidence?: Array<{
    market: string;
    evidenceState: string;
    lastDecisionAt?: number | null;
    decision?: string | null;
    riskDisposition?: string | null;
    externalEvidenceActive?: number;
    externalEvidenceContradictions?: number;
    evidenceIds?: string[];
    primaryReason?: string | null;
  }>;
  recentTrades?: Array<{
    id: string;
    market: string;
    closedAt: number;
    netPnl: number;
    returnPct: number;
    exitReason: string;
    strategyVersion: string;
  }>;
};

type OperatorLog = {
  available?: boolean;
  error?: string;
  retainedCycles?: number;
  historyAvailable?: boolean;
  cycles?: Array<{
    cycleNumber: number;
    startedAt: number;
    finishedAt: number;
    durationMs: number;
    scanned: number;
    entered: number;
    exited: number;
    held: number;
    noTrade: number;
    errorCount: number;
  }>;
  monitorDecisions?: Decision[];
  evidenceTransitions?: Array<{
    cycleNumber: number;
    timestamp: number;
    market: string;
    from: string;
    to: string;
    resolved: boolean;
    evidenceIds: string[];
  }>;
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

type MonitorEvent = {
  id: string;
  timestamp: number;
  kind: Exclude<EventKind, 'ALL'>;
  severity: Severity;
  market?: string | null;
  label: string;
  summary: string;
  metadata: Array<{ label: string; value: string }>;
  details: string[];
  evidenceIds?: string[];
};

const EVENT_FILTERS: EventKind[] = ['ALL', 'CYCLE', 'DECISION', 'RISK', 'EVIDENCE', 'TRADE', 'SYSTEM'];
const SEVERITY_FILTERS: Array<'all' | Severity> = ['all', 'critical', 'warning', 'normal'];
const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const pct = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const moneyText = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : value < 0 ? '-' : ''}₩${money.format(Math.abs(value))}`;
const stamp = (value: number | null | undefined) => value ? new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '—';
const age = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 60_000) return `${Math.round(value / 1_000)}s`;
  if (value < 3_600_000) return `${Math.round(value / 60_000)}m`;
  return `${decimal.format(value / 3_600_000)}h`;
};

const decisionSeverity = (item: Decision): Severity => {
  if (item.riskDisposition === 'REJECT') return 'warning';
  if ((item.evidenceContradictionCount || 0) > 0) return 'warning';
  if ((item.decision === 'ENTER' || item.decision === 'EXIT') && (item.auditCompleteness?.score ?? 100) < 70) return 'warning';
  if (item.decision === 'ENTER' || item.decision === 'EXIT') return 'normal';
  return 'info';
};

const buildEvents = (status: TradingStatus | null, log: OperatorLog | null): MonitorEvent[] => {
  if (!status?.available) return [];
  const events: MonitorEvent[] = [];

  (log?.cycles || []).slice(0, 24).forEach((cycle) => events.push({
    id: `cycle-${cycle.cycleNumber}-${cycle.finishedAt}`,
    timestamp: cycle.finishedAt,
    kind: 'CYCLE',
    severity: cycle.errorCount > 0 ? 'warning' : 'normal',
    label: `CYCLE #${cycle.cycleNumber}`,
    summary: `${cycle.scanned} scanned · ${cycle.entered} enter · ${cycle.exited} exit · ${cycle.held} hold · ${cycle.noTrade} no trade`,
    metadata: [
      { label: 'DURATION', value: `${decimal.format(cycle.durationMs / 1000)}s` },
      { label: 'ERRORS', value: String(cycle.errorCount) },
    ],
    details: [cycle.errorCount ? 'Cycle completed with persisted market errors.' : 'Cycle completed without a persisted market error.'],
  }));

  (log?.errors || []).forEach((item) => events.push({
    id: `error-${item.cycleNumber}-${item.market}-${item.timestamp}`,
    timestamp: item.timestamp,
    kind: 'SYSTEM',
    severity: 'critical',
    market: item.market,
    label: `CYCLE #${item.cycleNumber} ERROR`,
    summary: item.error,
    metadata: [{ label: 'MARKET', value: item.market }],
    details: ['A persisted Paper cycle error requires operator inspection.'],
  }));

  (log?.monitorDecisions || []).forEach((item) => {
    const repeats = item.repeatCount || 1;
    const completeness = item.auditCompleteness;
    events.push({
      id: `decision-${item.cycleNumber || 0}-${item.market}-${item.timestamp}`,
      timestamp: item.timestamp,
      kind: 'DECISION',
      severity: decisionSeverity(item),
      market: item.market,
      label: item.decision,
      summary: `${item.primaryReason || 'No persisted primary decision reason.'}${repeats > 1 ? ` · unchanged ×${repeats}` : ''}`,
      metadata: [
        { label: 'CYCLE', value: repeats > 1 ? `#${item.firstCycleNumber}→#${item.lastCycleNumber}` : `#${item.cycleNumber ?? '—'}` },
        { label: 'SCORE', value: item.oracleTradeScore == null ? '—' : String(item.oracleTradeScore) },
        { label: 'CONF', value: pct(item.confidence, 0) },
        { label: 'REGIME', value: item.regime || '—' },
        { label: 'ROUTE', value: item.strategyDisposition || '—' },
        { label: 'RISK', value: item.riskDisposition || '—' },
        { label: 'EVIDENCE', value: `${item.evidenceActiveCount || 0} · ${item.evidenceState || 'UNKNOWN'}` },
        { label: 'AUDIT', value: completeness ? `${completeness.score}% ${completeness.grade}` : '—' },
      ],
      details: [
        ...(item.reasons || []),
        ...(item.riskReasons || []).map((reason) => `Risk: ${reason}`),
        ...(completeness?.missing?.length ? [`Audit missing: ${completeness.missing.join(' · ')}`] : []),
        ...(item.tradeCaseId ? [`Trade case: ${item.tradeCaseId}`] : []),
      ],
      evidenceIds: item.evidenceIds || [],
    });
  });

  (log?.evidenceTransitions || []).forEach((transition) => events.push({
    id: `evidence-transition-${transition.cycleNumber}-${transition.market}-${transition.timestamp}`,
    timestamp: transition.timestamp,
    kind: 'EVIDENCE',
    severity: transition.resolved ? 'normal' : 'warning',
    market: transition.market,
    label: transition.resolved ? 'EVIDENCE RECOVERED' : 'EVIDENCE STATE CHANGED',
    summary: `${transition.from} → ${transition.to}`,
    metadata: [
      { label: 'CYCLE', value: `#${transition.cycleNumber}` },
      { label: 'STATE', value: transition.to },
    ],
    details: [transition.resolved ? 'Structured evidence coverage recovered for this market.' : 'Evidence state changed and should be reviewed before relying on new entries.'],
    evidenceIds: transition.evidenceIds || [],
  }));

  (status.positionEvidence || []).forEach((position) => {
    if (position.evidenceState === 'EVIDENCE_SUPPORTED') return;
    events.push({
      id: `current-evidence-${position.market}-${position.evidenceState}`,
      timestamp: position.lastDecisionAt || status.checkpoint?.savedAt || Date.now(),
      kind: 'EVIDENCE',
      severity: position.evidenceState === 'STALE' ? 'critical' : 'warning',
      market: position.market,
      label: `CURRENT ${position.evidenceState}`,
      summary: position.evidenceState === 'TECHNICAL_ONLY'
        ? 'Open position has no active structured external evidence attached.'
        : position.evidenceState === 'CONTESTED'
          ? 'Open position contains contradictory structured evidence.'
          : 'Position evidence or runtime context is stale.',
      metadata: [
        { label: 'ACTIVE', value: String(position.externalEvidenceActive || 0) },
        { label: 'CONTRADICTIONS', value: String(position.externalEvidenceContradictions || 0) },
        { label: 'RISK', value: position.riskDisposition || '—' },
      ],
      details: [position.primaryReason || 'No persisted decision explanation is available.'],
      evidenceIds: position.evidenceIds || [],
    });
  });

  (status.recentTrades || []).forEach((trade) => events.push({
    id: `trade-${trade.id}`,
    timestamp: trade.closedAt,
    kind: 'TRADE',
    severity: trade.netPnl < 0 ? 'warning' : 'normal',
    market: trade.market,
    label: trade.netPnl >= 0 ? 'TRADE CLOSED +P&L' : 'TRADE CLOSED -P&L',
    summary: `${moneyText(trade.netPnl)} · ${pct(trade.returnPct)} · ${trade.exitReason}`,
    metadata: [
      { label: 'NET P&L', value: moneyText(trade.netPnl) },
      { label: 'RETURN', value: pct(trade.returnPct) },
      { label: 'VERSION', value: trade.strategyVersion || '—' },
    ],
    details: [trade.exitReason],
  }));

  if (status.validation) {
    const verdict = status.validation.verdict;
    events.push({
      id: `validation-${status.checkpoint?.savedAt || 0}`,
      timestamp: status.checkpoint?.savedAt || Date.now(),
      kind: 'RISK',
      severity: verdict === 'REJECT' ? 'critical' : verdict === 'PASS' ? 'normal' : 'warning',
      label: `MONTE CARLO ${verdict}`,
      summary: `${status.validation.tradeCount} closed trades · survival ${pct(status.validation.survivalProbability, 1)} · ruin ${pct(status.validation.ruinProbability, 1)}`,
      metadata: [
        { label: 'SURVIVAL', value: pct(status.validation.survivalProbability, 1) },
        { label: 'RUIN', value: pct(status.validation.ruinProbability, 1) },
        { label: 'P95 DD', value: pct(status.validation.maxDrawdown?.p95, 1) },
      ],
      details: status.validation.reasons || [],
    });
  }

  if (status.checkpoint) events.push({
    id: `checkpoint-${status.checkpoint.savedAt}`,
    timestamp: status.checkpoint.savedAt,
    kind: 'SYSTEM',
    severity: status.loop?.stale ? 'warning' : 'info',
    label: 'CHECKPOINT SAVED',
    summary: `${status.checkpoint.backend} · ${status.checkpoint.reason}`,
    metadata: [
      { label: 'RUNTIME', value: status.checkpoint.runtimeId || 'black-oracle-paper' },
      { label: 'AGE', value: age(status.now ? status.now - status.checkpoint.savedAt : null) },
    ],
    details: ['Durable Paper state persisted for audit/recovery.'],
  });

  return events.sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
};

const tone = (severity: Severity) => severity === 'critical'
  ? 'border-[#D66565]/28 bg-[#D66565]/[0.035] text-[#E08A8A]'
  : severity === 'warning'
    ? 'border-[#C7A96B]/24 bg-[#C7A96B]/[0.025] text-[#D5B978]'
    : severity === 'normal'
      ? 'border-[#72B6A0]/18 bg-[#72B6A0]/[0.02] text-[#82BEAC]'
      : 'border-white/[0.065] bg-[#080C11] text-[#7C8791]';

const iconFor = (event: MonitorEvent) => {
  if (event.kind === 'RISK') return ShieldAlert;
  if (event.kind === 'EVIDENCE') return Database;
  if (event.kind === 'TRADE') return event.summary.includes('+₩') ? TrendingUp : TrendingDown;
  if (event.kind === 'CYCLE') return Activity;
  if (event.kind === 'SYSTEM') return SquareTerminal;
  return CircleDot;
};

export const MonitorView: React.FC = () => {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [log, setLog] = useState<OperatorLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventKind>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusResponse, logResponse] = await Promise.all([
        fetch('/api/trading-status', { cache: 'no-store' }),
        fetch('/api/operator-log?limit=48', { cache: 'no-store' }),
      ]);
      const [nextStatus, nextLog] = await Promise.all([
        statusResponse.json() as Promise<TradingStatus>,
        logResponse.json() as Promise<OperatorLog>,
      ]);
      setStatus(nextStatus);
      setLog(nextLog);
      setRuntimeError(statusResponse.ok ? null : nextStatus.error || 'Trading status request failed.');
      setLogError(logResponse.ok ? null : nextLog.error || 'Operator log request failed.');
      setLastFetchedAt(Date.now());
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : 'Operator monitor request failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const events = useMemo(() => buildEvents(status, log), [status, log]);
  const markets = useMemo(() => ['ALL', ...Array.from(new Set(events.map((event) => event.market).filter(Boolean) as string[])).sort()], [events]);
  const filtered = useMemo(() => events.filter((event) => {
    if (eventFilter !== 'ALL' && event.kind !== eventFilter) return false;
    if (severityFilter !== 'all' && event.severity !== severityFilter) return false;
    if (marketFilter !== 'ALL' && event.market !== marketFilter) return false;
    if (alertsOnly && event.severity !== 'critical' && event.severity !== 'warning') return false;
    return true;
  }), [alertsOnly, eventFilter, events, marketFilter, severityFilter]);

  const attention = useMemo(() => {
    const items: Array<{ severity: Severity; title: string; detail: string }> = [];
    if (runtimeError) items.push({ severity: 'critical', title: 'Runtime read failed', detail: runtimeError });
    if (logError) items.push({ severity: 'warning', title: 'Operator history degraded', detail: logError });
    if (status?.loop?.stale) items.push({ severity: 'critical', title: 'Paper runtime stale', detail: `Last cycle age ${age(status.loop.ageMs)}.` });
    if ((status?.ingestion?.lastCycleErrors || 0) > 0) items.push({ severity: 'critical', title: 'Cycle errors detected', detail: `${status?.ingestion?.lastCycleErrors} error(s) in the latest cycle.` });
    if ((status?.ingestion?.evidenceActive || 0) === 0) items.push({ severity: 'warning', title: 'No active structured evidence', detail: 'New decisions are operating without structured external evidence coverage.' });
    if ((log?.auditSummary?.averageScore ?? 100) < 70) items.push({ severity: 'warning', title: 'Audit completeness weak', detail: `Average retained-decision completeness is ${log?.auditSummary?.averageScore ?? 0}%.` });
    if (status?.validation?.verdict === 'REJECT') items.push({ severity: 'critical', title: 'Monte Carlo rejected', detail: status.validation.reasons?.[0] || 'Validation gate rejected the sample.' });
    else if (status?.validation?.verdict === 'WATCH' || status?.validation?.verdict === 'INSUFFICIENT_DATA') items.push({ severity: 'warning', title: `Monte Carlo ${status.validation.verdict}`, detail: status.validation.reasons?.[0] || 'Validation requires more evidence.' });
    return items.slice(0, 6);
  }, [log, logError, runtimeError, status]);

  const healthy = status?.status === 'OK' && !runtimeError;

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-3 pb-28 pt-3 text-[#E9EDF1] md:px-5 md:pb-20 md:pt-4 xl:px-6">
      <div className="mx-auto max-w-[1580px]">
        <header className="border border-white/[0.065] bg-[#070A0E]">
          <div className="flex flex-col gap-3 border-b border-white/[0.055] px-3 py-3 md:px-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center border ${healthy ? 'border-[#72B6A0]/25 text-[#72B6A0]' : 'border-[#C7A96B]/25 text-[#C7A96B]'}`}><SquareTerminal className="h-4 w-4" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#DDE3E8]">Operator Monitor</h1>
                  <span className={`border px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.12em] ${healthy ? 'border-[#72B6A0]/20 text-[#72B6A0]' : 'border-[#C7A96B]/20 text-[#C7A96B]'}`}>{status?.mode || 'PAPER'} · {status?.status || (loading ? 'LOADING' : 'UNKNOWN')}</span>
                  <span className="border border-white/[0.06] px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.1em] text-[#59636D]">history {log?.retainedCycles ?? 0}/48</span>
                </div>
                <p className="mt-1 text-[10px] text-[#5F6A74]">State-change supervision · repeated HOLD/NO_TRADE compressed · full raw history remains in Audit.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setAlertsOnly((value) => !value)} className={`border px-2.5 py-2 font-mono text-[6px] uppercase tracking-[0.13em] ${alertsOnly ? 'border-[#C7A96B]/30 bg-[#C7A96B]/[0.05] text-[#D5B978]' : 'border-white/[0.07] text-[#68737D]'}`}>Alerts only</button>
              <button onClick={() => setAutoRefresh((value) => !value)} className="flex items-center gap-2 border border-white/[0.07] px-2.5 py-2 font-mono text-[6px] uppercase tracking-[0.13em] text-[#68737D]">{autoRefresh ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{autoRefresh ? 'Live' : 'Paused'}</button>
              <button onClick={() => { setLoading(true); void load(); }} className="flex items-center gap-2 border border-white/[0.07] px-2.5 py-2 font-mono text-[6px] uppercase tracking-[0.13em] text-[#68737D]"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4 xl:grid-cols-8">
            <Metric label="EQUITY" value={status?.portfolio?.equity == null ? '—' : `₩${money.format(status.portfolio.equity)}`} />
            <Metric label="DAILY P&L" value={pct(status?.portfolio?.dailyPnlPct)} />
            <Metric label="CURRENT DD" value={pct(status?.portfolio?.currentDrawdownPct)} warning={(status?.portfolio?.currentDrawdownPct || 0) > 0.03} />
            <Metric label="OPEN" value={String(status?.portfolio?.openPositions?.length ?? 0)} />
            <Metric label="EVIDENCE" value={String(status?.ingestion?.evidenceActive ?? 0)} warning={(status?.ingestion?.evidenceActive || 0) === 0} />
            <Metric label="AUDIT AVG" value={`${log?.auditSummary?.averageScore ?? 0}%`} warning={(log?.auditSummary?.averageScore ?? 100) < 70} />
            <Metric label="WEAK TRACE" value={String(log?.auditSummary?.weak ?? 0)} warning={(log?.auditSummary?.weak || 0) > 0} />
            <Metric label="MC" value={status?.validation?.verdict || '—'} warning={status?.validation?.verdict !== 'PASS'} />
          </div>
        </header>

        {attention.length > 0 && (
          <section className="mt-3 border border-[#C7A96B]/16 bg-[#090B0E]">
            <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2.5 font-mono text-[7px] uppercase tracking-[0.16em] text-[#C7A96B]"><AlertTriangle className="h-3.5 w-3.5" />Attention queue</div>
            <div className="grid gap-px bg-white/[0.04] lg:grid-cols-2 xl:grid-cols-3">
              {attention.map((item, index) => <div key={`${item.title}-${index}`} className="bg-[#070A0E] p-3"><div className={`font-mono text-[6px] uppercase tracking-[0.13em] ${item.severity === 'critical' ? 'text-[#D66565]' : 'text-[#C7A96B]'}`}>{item.title}</div><div className="mt-1.5 text-[9px] leading-relaxed text-[#68737D]">{item.detail}</div></div>)}
            </div>
          </section>
        )}

        <section className="mt-3 border border-white/[0.065] bg-[#070A0E]">
          <div className="flex flex-col gap-2 border-b border-white/[0.055] p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1 overflow-x-auto pb-1">{EVENT_FILTERS.map((item) => <button key={item} onClick={() => setEventFilter(item)} className={`shrink-0 border px-2 py-1.5 font-mono text-[6px] uppercase tracking-[0.11em] ${eventFilter === item ? 'border-[#43D9E6]/25 text-[#7FD2DA]' : 'border-white/[0.055] text-[#4D5862]'}`}>{item}</button>)}</div>
            <div className="flex gap-2">
              <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} className="h-8 border border-white/[0.06] bg-[#05070A] px-2 font-mono text-[7px] text-[#69747E] outline-none">{markets.map((item) => <option key={item}>{item}</option>)}</select>
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as 'all' | Severity)} className="h-8 border border-white/[0.06] bg-[#05070A] px-2 font-mono text-[7px] uppercase text-[#69747E] outline-none">{SEVERITY_FILTERS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            </div>
          </div>

          <div className="divide-y divide-white/[0.045]">
            {filtered.map((event) => {
              const Icon = iconFor(event);
              const open = expanded === event.id;
              return (
                <button key={event.id} onClick={() => setExpanded(open ? null : event.id)} className="block w-full px-3 py-3 text-left transition hover:bg-white/[0.012] md:px-4">
                  <div className="flex gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border ${tone(event.severity)}`}><Icon className="h-3.5 w-3.5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 font-mono text-[6px] uppercase tracking-[0.11em]"><span className={event.severity === 'critical' ? 'text-[#D66565]' : event.severity === 'warning' ? 'text-[#C7A96B]' : 'text-[#68737D]'}>{event.kind}</span>{event.market && <span className="text-[#9EA8B1]">{event.market}</span>}<span className="text-[#7F8A94]">{event.label}</span></div>
                          <div className="mt-1 text-[10px] leading-relaxed text-[#ADB6BE]">{event.summary}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 font-mono text-[6px] text-[#4D5862]"><span>{stamp(event.timestamp)}</span><ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} /></div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[6px] uppercase tracking-[0.08em] text-[#4F5A64]">{event.metadata.map((meta) => <span key={`${event.id}-${meta.label}`}>{meta.label} <b className="font-normal text-[#84909A]">{meta.value}</b></span>)}</div>
                      {open && <div className="mt-3 grid gap-3 border-t border-white/[0.045] pt-3 lg:grid-cols-2"><TraceBlock title="TRACE / REASONS" lines={event.details} /><TraceBlock title="EVIDENCE IDS" lines={event.evidenceIds?.length ? event.evidenceIds : ['No structured evidence ID attached.']} mono /></div>}
                    </div>
                  </div>
                </button>
              );
            })}
            {!filtered.length && <div className="px-5 py-14 text-center font-mono text-[7px] uppercase tracking-[0.16em] text-[#4F5963]">No events match the current supervision filters.</div>}
          </div>
        </section>

        <footer className="mt-3 flex flex-col gap-2 border border-white/[0.06] bg-[#070A0E] p-3 font-mono text-[6px] uppercase tracking-[0.1em] text-[#4E5963] sm:flex-row sm:items-center sm:justify-between"><span>full decisions remain uncompressed in Audit · last refresh {stamp(lastFetchedAt)}</span><span>{log?.auditSummary?.missingCouncil ?? 0} missing council · {log?.auditSummary?.missingExecutionTrace ?? 0} missing execution links</span></footer>
      </div>
    </div>
  );
};

const Metric = ({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) => <div className="bg-[#070A0E] px-3 py-2.5"><div className="font-mono text-[5px] uppercase tracking-[0.14em] text-[#46515B]">{label}</div><div className={`mt-1 font-mono text-[10px] tabular-nums ${warning ? 'text-[#C7A96B]' : 'text-[#AEB7BF]'}`}>{value}</div></div>;

const TraceBlock = ({ title, lines, mono = false }: { title: string; lines: string[]; mono?: boolean }) => <div className="border border-white/[0.055] bg-[#05070A] p-3"><div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#59636D]">{title}</div><div className={`mt-2 space-y-1.5 text-[9px] leading-relaxed text-[#77818B] ${mono ? 'font-mono text-[7px]' : ''}`}>{lines.length ? lines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : <div>None persisted.</div>}</div></div>;
