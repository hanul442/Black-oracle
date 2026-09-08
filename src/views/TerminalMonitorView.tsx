import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Pause, Play, RefreshCw } from 'lucide-react';

type TradingStatus = any;
type OperatorLog = any;

type TerminalEvent = {
  id: string;
  timestamp: number;
  type: string;
  market: string;
  action: string;
  score: string;
  confidence: string;
  risk: string;
  evidence: string;
  text: string;
  tone: 'good' | 'warn' | 'bad' | 'muted';
};

const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const pct = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;

const moneyText = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : value < 0 ? '-' : ''}₩${money.format(Math.abs(value))}`;

const stamp = (value: number | null | undefined) =>
  value ? new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)) : '—';

const age = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 60_000) return `${Math.round(value / 1_000)}s`;
  if (value < 3_600_000) return `${Math.round(value / 60_000)}m`;
  return `${decimal.format(value / 3_600_000)}h`;
};

const toneClass = (tone: TerminalEvent['tone']) =>
  tone === 'bad' ? 'text-[#ff6262]' : tone === 'warn' ? 'text-[#f3b642]' : tone === 'good' ? 'text-[#62d49f]' : 'text-[#77818a]';

const buildEvents = (status: TradingStatus | null, log: OperatorLog | null): TerminalEvent[] => {
  const events: TerminalEvent[] = [];

  for (const item of log?.monitorDecisions || []) {
    const decision = String(item.decision || 'UNKNOWN');
    const risk = String(item.riskDisposition || '—');
    const contradictions = Number(item.evidenceContradictionCount || 0);
    const tone: TerminalEvent['tone'] = risk === 'REJECT' || contradictions > 0
      ? 'warn'
      : decision === 'ENTER' || decision === 'EXIT'
        ? 'good'
        : 'muted';
    events.push({
      id: `d-${item.cycleNumber || 0}-${item.market}-${item.timestamp}`,
      timestamp: item.timestamp,
      type: 'DECISION',
      market: item.market || '—',
      action: decision,
      score: item.oracleTradeScore == null ? '—' : String(item.oracleTradeScore),
      confidence: pct(item.confidence, 0),
      risk,
      evidence: `${item.evidenceActiveCount || 0}/${contradictions}`,
      text: item.primaryReason || 'No persisted decision reason.',
      tone,
    });
  }

  for (const cycle of log?.cycles || []) {
    events.push({
      id: `c-${cycle.cycleNumber}-${cycle.finishedAt}`,
      timestamp: cycle.finishedAt,
      type: 'CYCLE',
      market: 'ALL',
      action: `#${cycle.cycleNumber}`,
      score: '—',
      confidence: '—',
      risk: cycle.errorCount > 0 ? 'WARN' : 'OK',
      evidence: '—',
      text: `${cycle.scanned} scanned · ${cycle.entered} enter · ${cycle.exited} exit · ${cycle.held} hold · ${cycle.noTrade} no trade · ${decimal.format(cycle.durationMs / 1000)}s`,
      tone: cycle.errorCount > 0 ? 'warn' : 'muted',
    });
  }

  for (const trade of status?.recentTrades || []) {
    events.push({
      id: `t-${trade.id}`,
      timestamp: trade.closedAt,
      type: 'TRADE',
      market: trade.market,
      action: 'CLOSE',
      score: trade.entryOracleTradeScore == null ? '—' : String(trade.entryOracleTradeScore),
      confidence: pct(trade.returnPct),
      risk: trade.netPnl >= 0 ? 'PROFIT' : 'LOSS',
      evidence: '—',
      text: `${moneyText(trade.netPnl)} · ${trade.exitReason || 'closed'} · ${trade.strategyVersion || '—'}`,
      tone: trade.netPnl >= 0 ? 'good' : 'warn',
    });
  }

  for (const item of log?.errors || []) {
    events.push({
      id: `e-${item.cycleNumber}-${item.market}-${item.timestamp}`,
      timestamp: item.timestamp,
      type: 'SYSTEM',
      market: item.market || '—',
      action: 'ERROR',
      score: '—',
      confidence: '—',
      risk: 'CRITICAL',
      evidence: '—',
      text: item.error || 'Persisted runtime error.',
      tone: 'bad',
    });
  }

  return events.sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
};

export const TerminalMonitorView: React.FC = () => {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [log, setLog] = useState<OperatorLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [market, setMarket] = useState('ALL');
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusResponse, logResponse] = await Promise.all([
        fetch('/api/trading-status', { cache: 'no-store' }),
        fetch('/api/operator-log?limit=48', { cache: 'no-store' }),
      ]);
      const [nextStatus, nextLog] = await Promise.all([statusResponse.json(), logResponse.json()]);
      setStatus(nextStatus);
      setLog(nextLog);
      setError(statusResponse.ok && logResponse.ok ? null : nextStatus?.error || nextLog?.error || 'Operator data request failed.');
      setLastFetchedAt(Date.now());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Operator data request failed.');
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
  const markets = useMemo(() => ['ALL', ...Array.from(new Set(events.map((item) => item.market).filter((item) => item && item !== 'ALL'))).sort()], [events]);
  const filteredEvents = useMemo(() => events.filter((item) => {
    if (filter !== 'ALL' && item.type !== filter) return false;
    if (market !== 'ALL' && item.market !== market) return false;
    return true;
  }), [events, filter, market]);

  const curve = useMemo(() => (status?.equityCurve || []).map((item: any, index: number) => ({
    index,
    timestamp: item.timestamp ?? item.at ?? item.time ?? index,
    equity: Number(item.equity),
  })).filter((item: any) => Number.isFinite(item.equity)), [status]);

  const attention = useMemo(() => {
    const items: Array<{ label: string; value: string; tone: 'bad' | 'warn' }> = [];
    if (error) items.push({ label: 'DATA', value: error, tone: 'bad' });
    if (status?.loop?.stale) items.push({ label: 'RUNTIME', value: `stale ${age(status.loop.ageMs)}`, tone: 'bad' });
    if ((status?.ingestion?.lastCycleErrors || 0) > 0) items.push({ label: 'CYCLE', value: `${status.ingestion.lastCycleErrors} errors`, tone: 'bad' });
    if ((status?.ingestion?.evidenceActive || 0) === 0) items.push({ label: 'EVIDENCE', value: '0 active', tone: 'warn' });
    if ((log?.auditSummary?.averageScore ?? 100) < 70) items.push({ label: 'AUDIT', value: `${log?.auditSummary?.averageScore ?? 0}% avg`, tone: 'warn' });
    if (status?.validation?.verdict && status.validation.verdict !== 'PASS') items.push({ label: 'MC', value: status.validation.verdict, tone: 'warn' });
    return items;
  }, [error, log, status]);

  const healthy = status?.status === 'OK' && !error;
  const openCount = status?.portfolio?.openPositions?.length ?? 0;
  const latestCycle = status?.loop?.lastCycle;

  return (
    <div className="terminal-screen h-full overflow-hidden bg-[#030405] text-[#d9dde1]">
      <div className="flex h-full min-h-0 flex-col">
        <div className="terminal-strip flex min-h-[34px] shrink-0 items-center gap-3 overflow-x-auto border-b border-[#24282c] bg-[#070809] px-3 font-mono text-[8px] uppercase tracking-[0.08em]">
          <span className="font-semibold text-[#f3a312]">BO</span>
          <span className={healthy ? 'text-[#62d49f]' : 'text-[#f3b642]'}>{status?.mode || 'PAPER'} / {status?.status || (loading ? 'LOADING' : 'UNKNOWN')}</span>
          <span className="text-[#545d65]">|</span>
          <span>CYCLE <b className="font-normal text-[#c4cbd1]">#{status?.loop?.cycleCount ?? '—'}</b></span>
          <span>AGE <b className="font-normal text-[#c4cbd1]">{age(status?.loop?.ageMs)}</b></span>
          <span>EVID <b className={(status?.ingestion?.evidenceActive || 0) === 0 ? 'font-normal text-[#f3b642]' : 'font-normal text-[#c4cbd1]'}>{status?.ingestion?.evidenceActive ?? 0}</b></span>
          <span>AUDIT <b className="font-normal text-[#c4cbd1]">{log?.auditSummary?.averageScore ?? 0}%</b></span>
          <span>MC <b className={status?.validation?.verdict === 'PASS' ? 'font-normal text-[#62d49f]' : 'font-normal text-[#f3b642]'}>{status?.validation?.verdict || '—'}</b></span>
          <span className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setAutoRefresh((value) => !value)} className="terminal-action">{autoRefresh ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{autoRefresh ? 'LIVE' : 'PAUSE'}</button>
            <button onClick={() => { setLoading(true); void load(); }} className="terminal-action"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />REFRESH</button>
          </span>
        </div>

        {attention.length > 0 && (
          <div className="flex shrink-0 gap-px overflow-x-auto border-b border-[#24282c] bg-[#24282c]">
            {attention.map((item, index) => (
              <div key={`${item.label}-${index}`} className="min-w-max bg-[#090a0b] px-3 py-1.5 font-mono text-[7px] uppercase tracking-[0.08em]">
                <span className={item.tone === 'bad' ? 'text-[#ff6262]' : 'text-[#f3b642]'}>{item.label}</span>
                <span className="ml-2 text-[#8b949c]">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-[#24282c] bg-[#24282c] sm:grid-cols-4 xl:grid-cols-8">
          <Metric label="EQUITY" value={status?.portfolio?.equity == null ? '—' : `₩${money.format(status.portfolio.equity)}`} />
          <Metric label="CASH" value={status?.portfolio?.cash == null ? '—' : `₩${money.format(status.portfolio.cash)}`} />
          <Metric label="REALIZED" value={moneyText(status?.portfolio?.realizedPnl)} tone={(status?.portfolio?.realizedPnl || 0) < 0 ? 'warn' : 'normal'} />
          <Metric label="DAY P&L" value={pct(status?.portfolio?.dailyPnlPct)} tone={(status?.portfolio?.dailyPnlPct || 0) < 0 ? 'warn' : 'normal'} />
          <Metric label="CURRENT DD" value={pct(status?.portfolio?.currentDrawdownPct)} tone={(status?.portfolio?.currentDrawdownPct || 0) > 0.03 ? 'warn' : 'normal'} />
          <Metric label="OPEN" value={String(openCount)} />
          <Metric label="WIN RATE" value={pct(status?.performance?.winRate)} />
          <Metric label="TOTAL RET" value={pct(status?.performance?.totalReturnPct)} tone={(status?.performance?.totalReturnPct || 0) < 0 ? 'warn' : 'normal'} />
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[210px_minmax(0,1fr)] gap-px bg-[#24282c] xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,.75fr)] xl:grid-rows-1">
          <section className="min-h-0 bg-[#050607]">
            <div className="flex h-7 items-center justify-between border-b border-[#202429] px-2.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[#717b84]">
              <span><b className="font-normal text-[#f3a312]">1</b> EQUITY / PERFORMANCE</span>
              <span>{curve.length} pts · {status?.performance?.trades ?? 0} closed trades</span>
            </div>
            <div className="h-[calc(100%-28px)] min-h-0 px-1 py-1">
              {curve.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve} margin={{ top: 8, right: 12, left: 2, bottom: 2 }}>
                    <CartesianGrid stroke="#171a1d" vertical={false} />
                    <XAxis dataKey="index" hide />
                    <YAxis width={72} tick={{ fill: '#69737c', fontSize: 9 }} tickFormatter={(value) => `₩${money.format(value)}`} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#090a0b', border: '1px solid #2a2f34', borderRadius: 0, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                      labelStyle={{ color: '#7d8790' }}
                      formatter={(value: any) => [`₩${money.format(Number(value))}`, 'Equity']}
                    />
                    <Line type="monotone" dataKey="equity" stroke="#f3a312" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-[8px] uppercase tracking-[0.08em] text-[#515960]">Equity history unavailable</div>
              )}
            </div>
          </section>

          <aside className="min-h-0 bg-[#050607]">
            <div className="flex h-7 items-center border-b border-[#202429] px-2.5 font-mono text-[7px] uppercase tracking-[0.08em] text-[#717b84]"><b className="mr-2 font-normal text-[#f3a312]">2</b> RISK / VALIDATION</div>
            <div className="grid h-[calc(100%-28px)] grid-cols-2 gap-px overflow-y-auto bg-[#202429] xl:grid-cols-1">
              <RiskRow label="MONTE CARLO" value={status?.validation?.verdict || '—'} detail={`${status?.validation?.tradeCount ?? 0} trades · surv ${pct(status?.validation?.survivalProbability, 1)} · ruin ${pct(status?.validation?.ruinProbability, 1)}`} warn={status?.validation?.verdict !== 'PASS'} />
              <RiskRow label="HISTORICAL" value={status?.historicalValidation?.verdict || '—'} detail={`${status?.historicalValidation?.samples ?? status?.historicalValidation?.sampleCount ?? '—'} samples · ${status?.historicalValidation?.observationDays ?? '—'}d`} warn={status?.historicalValidation?.verdict !== 'PASS'} />
              <RiskRow label="WALK FORWARD" value={status?.walkForwardValidation?.verdict || '—'} detail={`${status?.walkForwardValidation?.folds?.length ?? status?.walkForwardValidation?.foldCount ?? '—'} folds`} warn={status?.walkForwardValidation?.verdict !== 'PASS'} />
              <RiskRow label="LIVE ELIGIBILITY" value={status?.liveEligibility?.eligible ? 'ELIGIBLE' : 'BLOCKED'} detail={status?.liveEligibility?.blockers?.[0] || 'Human approval remains required.'} warn={!status?.liveEligibility?.eligible} />
              <RiskRow label="AUDIT" value={`${log?.auditSummary?.averageScore ?? 0}%`} detail={`${log?.auditSummary?.weak ?? 0} weak · ${log?.auditSummary?.missingCouncil ?? 0} council gaps`} warn={(log?.auditSummary?.averageScore ?? 100) < 70} />
              <RiskRow label="LATEST CYCLE" value={latestCycle ? `${latestCycle.scanned} SCANNED` : '—'} detail={latestCycle ? `${latestCycle.entered} enter · ${latestCycle.exited} exit · ${latestCycle.errors?.length ?? 0} errors` : 'No cycle persisted.'} warn={(latestCycle?.errors?.length || 0) > 0} />
            </div>
          </aside>
        </div>

        <section className="flex min-h-0 flex-[1.45] flex-col border-t border-[#24282c] bg-[#050607]">
          <div className="flex h-8 shrink-0 items-center gap-2 overflow-x-auto border-b border-[#202429] px-2 font-mono text-[7px] uppercase tracking-[0.08em]">
            <span className="mr-1 text-[#717b84]"><b className="mr-2 font-normal text-[#f3a312]">3</b> DECISION LOG</span>
            {['ALL', 'DECISION', 'TRADE', 'CYCLE', 'SYSTEM'].map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'terminal-filter terminal-filter-active' : 'terminal-filter'}>{item}</button>
            ))}
            <select value={market} onChange={(event) => setMarket(event.target.value)} className="terminal-select ml-auto">
              {markets.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div className="min-h-0 flex-1 overflow-auto font-mono">
            <div className="sticky top-0 z-10 grid min-w-[980px] grid-cols-[76px_72px_94px_72px_58px_60px_78px_64px_minmax(360px,1fr)] border-b border-[#262b30] bg-[#0a0b0c] px-2 py-1.5 text-[6px] uppercase tracking-[0.08em] text-[#59636b]">
              <span>TIME</span><span>TYPE</span><span>MARKET</span><span>ACTION</span><span>SCORE</span><span>CONF</span><span>RISK</span><span>EVID</span><span>MESSAGE</span>
            </div>
            {filteredEvents.map((item) => (
              <div key={item.id} className="grid min-w-[980px] grid-cols-[76px_72px_94px_72px_58px_60px_78px_64px_minmax(360px,1fr)] border-b border-[#15191c] px-2 py-1.5 text-[7px] leading-4 hover:bg-[#0a0c0e]">
                <span className="text-[#59636b]">{stamp(item.timestamp)}</span>
                <span className={toneClass(item.tone)}>{item.type}</span>
                <span className="text-[#c7cdd2]">{item.market}</span>
                <span className={toneClass(item.tone)}>{item.action}</span>
                <span className="tabular-nums text-[#9ca5ad]">{item.score}</span>
                <span className="tabular-nums text-[#9ca5ad]">{item.confidence}</span>
                <span className={toneClass(item.tone)}>{item.risk}</span>
                <span className="text-[#869099]">{item.evidence}</span>
                <span className="truncate pr-2 text-[#a6aeb5]" title={item.text}>{item.text}</span>
              </div>
            ))}
            {!filteredEvents.length && <div className="px-3 py-10 text-center text-[7px] uppercase tracking-[0.08em] text-[#4f585f]">No matching operator events</div>}
          </div>
        </section>

        <div className="flex h-5 shrink-0 items-center justify-between border-t border-[#24282c] bg-[#070809] px-2.5 font-mono text-[6px] uppercase tracking-[0.08em] text-[#505960]">
          <span>persisted state only · no synthetic values · new entry requires evidence + scenario + council + risk</span>
          <span>refresh {stamp(lastFetchedAt)}</span>
        </div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' }) => (
  <div className="bg-[#070809] px-2.5 py-2 font-mono">
    <div className="text-[5.5px] uppercase tracking-[0.08em] text-[#59636b]">{label}</div>
    <div className={`mt-1 text-[11px] tabular-nums ${tone === 'warn' ? 'text-[#f3b642]' : 'text-[#cbd1d6]'}`}>{value}</div>
  </div>
);

const RiskRow = ({ label, value, detail, warn = false }: { label: string; value: string; detail: string; warn?: boolean }) => (
  <div className="bg-[#070809] px-2.5 py-2 font-mono">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[6px] uppercase tracking-[0.08em] text-[#626c74]">{label}</span>
      <span className={`text-[7px] uppercase ${warn ? 'text-[#f3b642]' : 'text-[#62d49f]'}`}>{value}</span>
    </div>
    <div className="mt-1 line-clamp-2 text-[6.5px] leading-3 text-[#77818a]" title={detail}>{detail}</div>
  </div>
);
