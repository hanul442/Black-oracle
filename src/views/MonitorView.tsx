import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Database,
  Filter,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SquareTerminal,
  TrendingDown,
  TrendingUp,
  WalletCards,
  XCircle,
} from 'lucide-react';

type EventKind = 'ALL' | 'CYCLE' | 'DECISION' | 'RISK' | 'EVIDENCE' | 'TRADE' | 'SYSTEM';
type Severity = 'critical' | 'warning' | 'normal' | 'info';

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
  evidenceActiveCount?: number;
  evidenceContradictionCount?: number;
  evidenceIds?: string[];
  primaryReason?: string | null;
  reasons?: string[];
  riskReasons?: string[];
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
  performance?: {
    totalReturnPct: number;
    maxDrawdownPct: number;
    trades: number;
    winRate: number;
  };
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
  decisionTape?: Decision[];
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
  decisions?: Decision[];
  errors?: Array<{ cycleNumber: number; timestamp: number; market: string; error: string }>;
};

const EVENT_FILTERS: EventKind[] = ['ALL', 'CYCLE', 'DECISION', 'RISK', 'EVIDENCE', 'TRADE', 'SYSTEM'];
const SEVERITY_FILTERS: Array<'all' | Severity> = ['all', 'critical', 'warning', 'normal'];
const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const pct = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const signedPct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
const moneyText = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : value < 0 ? '-' : ''}₩${money.format(Math.abs(value))}`;
const clock = (value: number | null | undefined) => value ? new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '—';
const age = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 60_000) return `${Math.round(value / 1_000)}s`;
  if (value < 3_600_000) return `${Math.round(value / 60_000)}m`;
  return `${compact.format(value / 3_600_000)}h`;
};

const decisionSeverity = (decision: Decision): Severity => {
  if (decision.riskDisposition === 'REJECT') return 'warning';
  if ((decision.evidenceContradictionCount || 0) > 0) return 'warning';
  if (decision.decision === 'ENTER' || decision.decision === 'EXIT') return 'normal';
  return 'info';
};

const buildEvents = (status: TradingStatus | null, log: OperatorLog | null): MonitorEvent[] => {
  if (!status?.available) return [];
  const events: MonitorEvent[] = [];
  const cycleRows = log?.cycles?.length ? log.cycles : status.loop?.lastCycle ? [{
    cycleNumber: status.loop.cycleCount,
    ...status.loop.lastCycle,
    noTrade: status.loop.lastCycle.noTrade || 0,
    errorCount: status.loop.lastCycle.errors.length,
  }] : [];
  const decisions = log?.decisions?.length ? log.decisions : status.decisionTape || [];
  const errors = log?.errors?.length ? log.errors : (status.loop?.lastCycle?.errors || []).map((item) => ({
    cycleNumber: status.loop?.cycleCount || 0,
    timestamp: status.loop?.lastCycle?.finishedAt || Date.now(),
    ...item,
  }));

  cycleRows.forEach((cycle) => events.push({
    id: `cycle-${cycle.cycleNumber}-${cycle.finishedAt}`,
    timestamp: cycle.finishedAt,
    kind: 'CYCLE',
    severity: cycle.errorCount > 0 ? 'warning' : 'normal',
    label: `CYCLE #${cycle.cycleNumber}`,
    summary: `${cycle.scanned} scanned · ${cycle.entered} enter · ${cycle.exited} exit · ${cycle.held} hold · ${cycle.noTrade} no trade`,
    metadata: [
      { label: 'DURATION', value: `${compact.format(cycle.durationMs / 1000)}s` },
      { label: 'ERRORS', value: String(cycle.errorCount) },
    ],
    details: [cycle.errorCount ? 'Cycle completed with persisted market errors.' : 'Cycle completed without a persisted market error.'],
  }));

  errors.forEach((item) => events.push({
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

  decisions.forEach((item) => {
    const evidenceState = (item.evidenceActiveCount || 0) > 0
      ? (item.evidenceContradictionCount || 0) > 0 ? 'CONTESTED' : 'SUPPORTED'
      : 'TECHNICAL ONLY';
    const forecast = item.forecast?.available ? `${item.forecast.direction} ${Math.round(item.forecast.confidence * 100)}%` : 'UNAVAILABLE';
    events.push({
      id: `decision-${item.cycleNumber || 0}-${item.market}-${item.timestamp}`,
      timestamp: item.timestamp,
      kind: 'DECISION',
      severity: decisionSeverity(item),
      market: item.market,
      label: item.decision,
      summary: item.primaryReason || 'No persisted primary decision reason.',
      metadata: [
        ...(item.cycleNumber ? [{ label: 'CYCLE', value: `#${item.cycleNumber}` }] : []),
        { label: 'SCORE', value: item.oracleTradeScore == null ? '—' : String(item.oracleTradeScore) },
        { label: 'CONF', value: pct(item.confidence, 0) },
        { label: 'REGIME', value: item.regime || '—' },
        { label: 'ROUTE', value: item.strategyDisposition || '—' },
        { label: 'RISK', value: item.riskDisposition || '—' },
        { label: 'EVIDENCE', value: `${item.evidenceActiveCount || 0} · ${evidenceState}` },
        { label: 'FORECAST', value: forecast },
      ],
      details: [...(item.reasons || []), ...(item.riskReasons || []).map((reason) => `Risk: ${reason}`)],
      evidenceIds: item.evidenceIds || [],
    });
  });

  (status.positionEvidence || []).forEach((position) => {
    if (position.evidenceState === 'EVIDENCE_SUPPORTED') return;
    events.push({
      id: `evidence-${position.market}-${position.lastDecisionAt || status.checkpoint?.savedAt || 0}`,
      timestamp: position.lastDecisionAt || status.checkpoint?.savedAt || Date.now(),
      kind: 'EVIDENCE',
      severity: position.evidenceState === 'STALE' ? 'critical' : 'warning',
      market: position.market,
      label: position.evidenceState,
      summary: position.evidenceState === 'TECHNICAL_ONLY'
        ? 'Open position has no active structured external evidence attached.'
        : position.evidenceState === 'CONTESTED'
          ? 'Open position contains contradictory structured evidence.'
          : 'Position evidence or runtime context is stale.',
      metadata: [
        { label: 'ACTIVE', value: String(position.externalEvidenceActive || 0) },
        { label: 'CONTRADICTIONS', value: String(position.externalEvidenceContradictions || 0) },
        { label: 'DECISION', value: position.decision || '—' },
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
    summary: `${moneyText(trade.netPnl)} · ${signedPct(trade.returnPct)} · ${trade.exitReason}`,
    metadata: [
      { label: 'NET P&L', value: moneyText(trade.netPnl) },
      { label: 'RETURN', value: signedPct(trade.returnPct) },
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

const toneForSeverity = (severity: Severity) => severity === 'critical'
  ? 'border-[#D66565]/28 bg-[#D66565]/[0.035] text-[#E08A8A]'
  : severity === 'warning'
    ? 'border-[#C7A96B]/24 bg-[#C7A96B]/[0.025] text-[#D5B978]'
    : severity === 'normal'
      ? 'border-[#72B6A0]/18 bg-[#72B6A0]/[0.02] text-[#82BEAC]'
      : 'border-white/[0.065] bg-[#080C11] text-[#7C8791]';

const iconForEvent = (event: MonitorEvent) => {
  if (event.kind === 'RISK') return ShieldAlert;
  if (event.kind === 'EVIDENCE') return Database;
  if (event.kind === 'TRADE') return event.summary.includes('+') ? TrendingUp : TrendingDown;
  if (event.kind === 'CYCLE') return Activity;
  if (event.kind === 'SYSTEM') return SquareTerminal;
  return CircleDot;
};

export const MonitorView: React.FC = () => {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [log, setLog] = useState<OperatorLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventKind>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusResponse, logResponse] = await Promise.all([
        fetch('/api/trading-status', { cache: 'no-store' }),
        fetch('/api/operator-log?limit=48', { cache: 'no-store' }),
      ]);
      const [statusPayload, logPayload] = await Promise.all([
        statusResponse.json() as Promise<TradingStatus>,
        logResponse.json() as Promise<OperatorLog>,
      ]);
      setStatus(statusPayload);
      setLog(logPayload);
      setFetchError(statusResponse.ok ? null : statusPayload.error || 'Trading status request failed.');
      setHistoryError(logResponse.ok ? null : logPayload.error || 'Operator history request failed.');
      setLastFetchedAt(Date.now());
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Operator monitor request failed.');
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
    if (alertsOnly && !['critical', 'warning'].includes(event.severity)) return false;
    return true;
  }), [alertsOnly, eventFilter, events, marketFilter, severityFilter]);

  const criticalCount = events.filter((event) => event.severity === 'critical').length;
  const warningCount = events.filter((event) => event.severity === 'warning').length;
  const attention = useMemo(() => {
    const items: Array<{ severity: Severity; title: string; detail: string }> = [];
    if (fetchError) items.push({ severity: 'critical', title: 'Runtime read failed', detail: fetchError });
    if (historyError) items.push({ severity: 'warning', title: 'Operator history degraded', detail: historyError });
    if (status?.loop?.stale) items.push({ severity: 'critical', title: 'Paper runtime stale', detail: `Last cycle age ${age(status.loop.ageMs)}.` });
    if ((status?.ingestion?.lastCycleErrors || 0) > 0) items.push({ severity: 'critical', title: 'Cycle errors detected', detail: `${status?.ingestion?.lastCycleErrors} error(s) in the latest cycle.` });
    if ((status?.ingestion?.evidenceActive || 0) === 0) items.push({ severity: 'warning', title: 'No active structured evidence', detail: 'Current Paper decisions remain technical-only unless evidence ingestion is restored.' });
    const contested = (status?.positionEvidence || []).filter((item) => item.evidenceState === 'CONTESTED').length;
    const technicalOnly = (status?.positionEvidence || []).filter((item) => item.evidenceState === 'TECHNICAL_ONLY').length;
    if (contested > 0) items.push({ severity: 'warning', title: 'Contested open positions', detail: `${contested} position(s) contain contradictory evidence.` });
    if (technicalOnly > 0) items.push({ severity: 'warning', title: 'Technical-only open positions', detail: `${technicalOnly} position(s) have no active external evidence.` });
    if (status?.validation?.verdict === 'REJECT') items.push({ severity: 'critical', title: 'Monte Carlo rejected', detail: status.validation.reasons?.[0] || 'Validation gate rejected the current sample.' });
    else if (status?.validation?.verdict === 'WATCH' || status?.validation?.verdict === 'INSUFFICIENT_DATA') items.push({ severity: 'warning', title: `Monte Carlo ${status.validation.verdict}`, detail: status.validation.reasons?.[0] || 'Validation requires more evidence.' });
    return items.slice(0, 5);
  }, [fetchError, historyError, status]);

  const statusHealthy = status?.status === 'OK' && !fetchError;

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-3 pb-28 pt-3 text-[#E9EDF1] md:px-5 md:pb-20 md:pt-4 xl:px-6">
      <div className="mx-auto max-w-[1580px]">
        <header className="border border-white/[0.065] bg-[#070A0E]">
          <div className="flex flex-col gap-3 border-b border-white/[0.055] px-3 py-3 md:px-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center border ${statusHealthy ? 'border-[#72B6A0]/25 text-[#72B6A0]' : 'border-[#C7A96B]/25 text-[#C7A96B]'}`}>
                <SquareTerminal className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#DDE3E8]">Operator Monitor</h1>
                  <span className={`border px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.12em] ${statusHealthy ? 'border-[#72B6A0]/20 text-[#72B6A0]' : 'border-[#C7A96B]/20 text-[#C7A96B]'}`}>
                    {status?.mode || 'PAPER'} · {status?.status || (loading ? 'LOADING' : 'UNKNOWN')}
                  </span>
                  <span className="border border-white/[0.06] px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.1em] text-[#59636D]">
                    history {log?.retainedCycles ?? 0}/48
                  </span>
                </div>
                <p className="mt-1 truncate text-[10px] text-[#5F6A74]">Persisted chronological supervision · evidence → decision → risk → execution → result</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setAlertsOnly((value) => !value)} className={`border px-2.5 py-2 font-mono text-[6px] uppercase tracking-[0.13em] ${alertsOnly ? 'border-[#C7A96B]/30 bg-[#C7A96B]/[0.05] text-[#D5B978]' : 'border-white/[0.07] text-[#68737D]'}`}>Alerts only</button>
              <button onClick={() => setAutoRefresh((value) => !value)} className="flex items-center gap-2 border border-white/[0.07] px-2.5 py-2 font-mono text-[6px] uppercase tracking-[0.13em] text-[#68737D]">
                {autoRefresh ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />} {autoRefresh ? 'Live' : 'Paused'}
              </button>
              <button onClick={() => { setLoading(true); void load(); }} className="flex items-center gap-2 border border-white/[0.07] px-2.5 py-2 font-mono text-[6px] uppercase tracking-[0.13em] text-[#68737D]">
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-white/[0.04] md:grid-cols-4 xl:grid-cols-8">
            <Metric label="EQUITY" value={status?.portfolio?.equity == null ? '—' : `₩${money.format(status.portfolio.equity)}`} />
            <Metric label="DAY P&L" value={signedPct(status?.portfolio?.dailyPnlPct)} tone={(status?.portfolio?.dailyPnlPct || 0) < 0 ? 'negative' : 'positive'} />
            <Metric label="DRAWDOWN" value={pct(status?.portfolio?.currentDrawdownPct)} tone={(status?.portfolio?.currentDrawdownPct || 0) > 0.03 ? 'negative' : undefined} />
            <Metric label="OPEN" value={String(status?.portfolio?.openPositions?.length ?? '—')} />
            <Metric label="EVIDENCE" value={String(status?.ingestion?.evidenceActive ?? '—')} tone={(status?.ingestion?.evidenceActive || 0) === 0 ? 'warning' : 'positive'} />
            <Metric label="CYCLE" value={String(status?.loop?.cycleCount ?? '—')} />
            <Metric label="CRITICAL" value={String(criticalCount)} tone={criticalCount > 0 ? 'negative' : 'positive'} />
            <Metric label="WARNING" value={String(warningCount)} tone={warningCount > 0 ? 'warning' : undefined} />
          </div>
        </header>

        <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 border border-white/[0.065] bg-[#070A0E]">
            <div className="border-b border-white/[0.055] px-3 py-3 md:px-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-[#6FCAD3]" /><span className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#8A959F]">Supervision log</span><span className="font-mono text-[6px] text-[#46515B]">{filtered.length}/{events.length}</span></div>
                  <div className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.1em] text-[#46515B]"><Clock3 className="h-3 w-3" /> last fetch {clock(lastFetchedAt)}</div>
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {EVENT_FILTERS.map((item) => <button key={item} onClick={() => setEventFilter(item)} className={`shrink-0 border px-2.5 py-1.5 font-mono text-[6px] uppercase tracking-[0.13em] ${eventFilter === item ? 'border-[#43D9E6]/24 bg-[#43D9E6]/[0.04] text-[#8BD8DF]' : 'border-white/[0.06] text-[#53606A]'}`}>{item}</button>)}
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {SEVERITY_FILTERS.map((item) => <button key={item} onClick={() => setSeverityFilter(item)} className={`shrink-0 px-2 py-1 font-mono text-[6px] uppercase tracking-[0.11em] ${severityFilter === item ? 'text-[#D8DEE4]' : 'text-[#46515B]'}`}>{item.toUpperCase()}</button>)}
                  </div>
                  <label className="flex h-8 min-w-0 items-center border border-white/[0.06] bg-[#05070A] px-2.5 md:w-[180px]">
                    <Filter className="mr-2 h-3 w-3 text-[#46515B]" />
                    <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent font-mono text-[7px] uppercase text-[#7B8791] outline-none">
                      {markets.map((market) => <option key={market} value={market} className="bg-[#080C11]">{market}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="divide-y divide-white/[0.045]">
              {filtered.map((event) => {
                const Icon = iconForEvent(event);
                const expanded = expandedId === event.id;
                return (
                  <button key={event.id} onClick={() => setExpandedId((current) => current === event.id ? null : event.id)} className="block w-full text-left transition hover:bg-white/[0.012]">
                    <div className="flex gap-3 px-3 py-3 md:px-4">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border ${toneForSeverity(event.severity)}`}><Icon className="h-3.5 w-3.5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1.5 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 font-mono text-[6px] uppercase tracking-[0.12em]">
                              <span className={event.severity === 'critical' ? 'text-[#D66565]' : event.severity === 'warning' ? 'text-[#C7A96B]' : event.severity === 'normal' ? 'text-[#72B6A0]' : 'text-[#60707B]'}>{event.kind}</span>
                              {event.market && <span className="text-[#8F9AA4]">{event.market}</span>}
                              <span className="text-[#46515B]">{clock(event.timestamp)}</span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="text-[11px] font-medium text-[#D2D8DE]">{event.label}</span><span className="text-[10px] leading-relaxed text-[#69747E]">{event.summary}</span></div>
                          </div>
                          <ChevronDown className={`mt-1 h-3.5 w-3.5 shrink-0 text-[#46515B] transition ${expanded ? 'rotate-180 text-[#8B969F]' : ''}`} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {event.metadata.map((item) => <span key={`${event.id}-${item.label}`} className="font-mono text-[6px] uppercase tracking-[0.1em] text-[#4E5963]">{item.label} <span className="text-[#89949E]">{item.value}</span></span>)}
                        </div>
                        {expanded && <div className="mt-3 border-l border-white/[0.07] pl-3"><div className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#59656F]">Trace detail</div><div className="mt-2 space-y-1.5">{(event.details.length ? event.details : ['No additional persisted detail.']).map((detail, index) => <div key={`${event.id}-detail-${index}`} className="text-[9px] leading-relaxed text-[#74808A]">{detail}</div>)}</div>{!!event.evidenceIds?.length && <div className="mt-3 flex flex-wrap gap-1">{event.evidenceIds.map((id) => <span key={id} className="border border-white/[0.06] bg-[#05070A] px-1.5 py-1 font-mono text-[6px] text-[#69747E]">{id}</span>)}</div>}</div>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {!filtered.length && <div className="px-5 py-16 text-center"><SquareTerminal className="mx-auto h-5 w-5 text-[#39434C]" /><div className="mt-3 font-mono text-[7px] uppercase tracking-[0.16em] text-[#59636D]">No matching monitor events</div></div>}
            </div>
          </div>

          <aside className="space-y-3 xl:sticky xl:top-0 xl:self-start">
            <section className="border border-white/[0.065] bg-[#070A0E]">
              <div className="flex items-center justify-between border-b border-white/[0.055] px-3 py-3"><div><div className="font-mono text-[6px] uppercase tracking-[0.15em] text-[#59636D]">Attention queue</div><div className="mt-1 text-[12px] text-[#C7CED4]">What needs inspection now</div></div>{attention.some((item) => item.severity === 'critical') ? <ShieldAlert className="h-4 w-4 text-[#D66565]" /> : <ShieldCheck className="h-4 w-4 text-[#72B6A0]" />}</div>
              <div className="divide-y divide-white/[0.045]">
                {attention.map((item, index) => <div key={`${item.title}-${index}`} className="flex gap-3 px-3 py-3">{item.severity === 'critical' ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D66565]" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C7A96B]" />}<div><div className="text-[10px] font-medium text-[#C6CDD3]">{item.title}</div><div className="mt-1 text-[9px] leading-relaxed text-[#68737D]">{item.detail}</div></div></div>)}
                {!attention.length && <div className="flex gap-3 px-3 py-4"><CheckCircle2 className="h-3.5 w-3.5 text-[#72B6A0]" /><div><div className="text-[10px] text-[#AEB7BF]">No immediate persisted alert</div><div className="mt-1 text-[9px] text-[#55616B]">Continue normal Paper supervision.</div></div></div>}
              </div>
            </section>

            <section className="border border-white/[0.065] bg-[#070A0E] p-3">
              <div className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.15em] text-[#59636D]"><WalletCards className="h-3 w-3" /> Book snapshot</div>
              <div className="mt-3 grid grid-cols-2 gap-px bg-white/[0.045]"><Mini label="TOTAL RETURN" value={signedPct(status?.performance?.totalReturnPct)} /><Mini label="MAX DD" value={pct(status?.performance?.maxDrawdownPct)} /><Mini label="TRADES" value={String(status?.performance?.trades ?? '—')} /><Mini label="WIN RATE" value={pct(status?.performance?.winRate)} /></div>
            </section>

            <section className="border border-white/[0.065] bg-[#070A0E] p-3">
              <div className="font-mono text-[6px] uppercase tracking-[0.15em] text-[#59636D]">Audit retention</div>
              <p className="mt-2 text-[9px] leading-relaxed text-[#68737D]">Recent cycle decisions are now persisted in the Paper checkpoint. Older deployments fall back to the latest cycle until new history accumulates.</p>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
};

const Metric = ({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' | 'warning' }) => (
  <div className="bg-[#070A0E] px-3 py-2.5"><div className="font-mono text-[5.5px] uppercase tracking-[0.13em] text-[#46515B]">{label}</div><div className={`mt-1 text-[11px] tabular-nums ${tone === 'positive' ? 'text-[#78B6A3]' : tone === 'negative' ? 'text-[#D57979]' : tone === 'warning' ? 'text-[#C7A96B]' : 'text-[#BFC7CE]'}`}>{value}</div></div>
);

const Mini = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#070A0E] p-2.5"><div className="font-mono text-[5.5px] uppercase tracking-[0.11em] text-[#46515B]">{label}</div><div className="mt-1 text-[10px] tabular-nums text-[#AEB7BF]">{value}</div></div>
);
