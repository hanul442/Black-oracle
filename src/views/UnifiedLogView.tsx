import React, { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronRight, Filter, RefreshCw, Search, X } from 'lucide-react';

type EventType = 'ALL' | 'TRADE' | 'DECISION' | 'EVIDENCE' | 'SYSTEM';

type LogEvent = {
  id: string;
  timestamp: number;
  type: Exclude<EventType, 'ALL'>;
  title: string;
  detail: string;
  meta?: string;
  trace?: Record<string, unknown> | null;
};

type StatusPayload = {
  success?: boolean;
  available?: boolean;
  status?: string;
  now?: number;
  checkpoint?: { savedAt?: number; reason?: string; runtimeId?: string; backend?: string };
  loop?: { lastCycle?: any; ageMs?: number | null; stale?: boolean };
  portfolio?: { openPositions?: any[]; initialEquity?: number; equity?: number; cash?: number };
  decisionTape?: any[];
  equityDecisions?: any[];
  evidenceFlow?: any[];
  evidenceRequests?: any[];
  narsInbox?: any[];
  recentTrades?: any[];
};

const filters: EventType[] = ['ALL', 'TRADE', 'DECISION', 'EVIDENCE', 'SYSTEM'];

const parseTime = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const time = (timestamp: number) => timestamp > 0
  ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(timestamp)
  : 'TIME —';
const money = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
const pct = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;

const renderValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined || value === '') return <span className="text-[#4B5660]">—</span>;
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString('ko-KR') : value.toFixed(4);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-[#4B5660]">[]</span>;
    return <div className="space-y-1">{value.slice(0, 20).map((item, index) => <div key={index}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</div>)}</div>;
  }
  return <pre className="max-w-full overflow-x-auto whitespace-pre-wrap text-[9px] leading-5 text-[#82909A]">{JSON.stringify(value, null, 2)}</pre>;
};

export const UnifiedLogView: React.FC = () => {
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [filter, setFilter] = useState<EventType>('ALL');
  const [query, setQuery] = useState('');
  const [brief, setBrief] = useState('');
  const [briefing, setBriefing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LogEvent | null>(null);

  const load = async () => {
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      setPayload(await response.json() as StatusPayload);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', load);
    };
  }, []);

  const events = useMemo<LogEvent[]>(() => {
    const next: LogEvent[] = [];

    for (const item of payload?.decisionTape ?? []) {
      next.push({
        id: `decision-${item.market}-${item.timestamp}`,
        timestamp: item.timestamp,
        type: 'DECISION',
        title: `${item.market} · ${item.decision}`,
        detail: item.primaryReason || item.reasons?.[0] || item.strategyDisposition || 'Decision recorded without a primary rationale.',
        meta: [item.regime, item.oracleTradeScore == null ? null : `score ${Number(item.oracleTradeScore).toFixed(1)}`, item.riskDisposition].filter(Boolean).join(' · '),
        trace: item,
      });
    }

    for (const item of payload?.equityDecisions ?? []) {
      next.push({
        id: `equity-decision-${item.market}-${item.timestamp}`,
        timestamp: item.timestamp,
        type: 'DECISION',
        title: `${item.market} · ${item.name || item.symbol || 'KRX'} · ${item.action}`,
        detail: item.reasons?.[0] || 'Equity Paper decision recorded.',
        meta: [`tech ${item.technicalScore == null ? '—' : Number(item.technicalScore).toFixed(1)}`, `evidence ${item.evidenceCount ?? 0}`, item.wavePhase].filter(Boolean).join(' · '),
        trace: item,
      });
    }

    for (const position of payload?.portfolio?.openPositions ?? []) {
      const currentMark = Number(position.markPrice ?? position.entryPrice ?? 0);
      const entry = Number(position.entryPrice ?? 0);
      const unrealized = Number(position.unrealizedPnl ?? 0);
      next.push({
        id: `position-${position.market}-${position.openedAt}`,
        timestamp: Number(position.updatedAt ?? position.openedAt ?? 0),
        type: 'TRADE',
        title: `${position.market} · OPEN POSITION`,
        detail: `Entry ${money(entry)} · Mark ${money(currentMark)} · Unrealized PnL ${money(unrealized)}`,
        meta: [`SL ${position.stopLossPrice == null ? '—' : money(position.stopLossPrice)}`, `TP1 ${position.takeProfit1Price == null ? '—' : money(position.takeProfit1Price)}`, `TP2 ${position.takeProfit2Price == null ? '—' : money(position.takeProfit2Price)}`].join(' · '),
        trace: position,
      });
    }

    for (const trade of payload?.recentTrades ?? []) {
      next.push({
        id: `trade-${trade.id}`,
        timestamp: trade.closedAt,
        type: 'TRADE',
        title: `${trade.market} · CLOSED`,
        detail: `${pct(Number(trade.returnPct ?? 0))} · ${trade.exitReason || 'exit'} · PnL ${money(Number(trade.netPnl ?? 0))}`,
        meta: trade.strategyVersion || 'strategy version unavailable',
        trace: trade,
      });
    }

    for (const item of payload?.evidenceFlow ?? []) {
      const observedAt = parseTime(item.observed_at);
      next.push({
        id: `evidence-${item.id}`,
        timestamp: observedAt,
        type: 'EVIDENCE',
        title: `${item.market} · ${item.title || 'NARS Evidence'}`,
        detail: item.rationale || `${item.direction || 'NEUTRAL'} Evidence received from NARS.`,
        meta: [item.evidence_grade, item.direction, item.source_type, item.eligible_for_new_risk ? 'NEW-RISK ELIGIBLE' : null].filter(Boolean).join(' · '),
        trace: item,
      });
    }

    for (const item of payload?.evidenceRequests ?? []) {
      const requestedAt = parseTime(item.requested_at);
      next.push({
        id: `evidence-request-${item.request_key}`,
        timestamp: requestedAt,
        type: 'EVIDENCE',
        title: `${item.market} · EVIDENCE ${item.status}`,
        detail: item.reason || 'Evidence coverage work requested.',
        meta: [item.asset_class, item.trigger, item.strategy_id].filter(Boolean).join(' · '),
        trace: item,
      });
    }

    if (payload?.checkpoint?.savedAt) {
      next.push({
        id: `system-${payload.checkpoint.savedAt}`,
        timestamp: payload.checkpoint.savedAt,
        type: 'SYSTEM',
        title: `Runtime checkpoint · ${payload.status || 'UNKNOWN'}`,
        detail: payload.checkpoint.reason || 'Runtime state persisted.',
        meta: [payload.checkpoint.runtimeId, payload.loop?.stale ? 'STALE' : 'FRESH'].filter(Boolean).join(' · '),
        trace: { checkpoint: payload.checkpoint, loop: payload.loop },
      });
    }

    return next.filter((item) => item.timestamp > 0).sort((a, b) => b.timestamp - a.timestamp).slice(0, 400);
  }, [payload]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (filter !== 'ALL' && event.type !== filter) return false;
      if (!needle) return true;
      return `${event.type} ${event.title} ${event.detail} ${event.meta || ''}`.toLowerCase().includes(needle);
    });
  }, [events, filter, query]);

  const explain = async () => {
    setBriefing(true);
    try {
      const response = await fetch('/api/activity-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: events.slice(0, 40).map(({ trace: _trace, ...event }) => event) }),
      });
      const data = await response.json();
      setBrief(data.brief || '최근 활동을 설명할 수 없습니다.');
    } catch {
      setBrief('최근 활동 요약 API에 연결하지 못했습니다. 원본 로그는 아래에서 계속 확인할 수 있습니다.');
    } finally {
      setBriefing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-24 pt-4 md:px-6 lg:pb-8 xl:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div>
            <div className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#43D9E6]">Traceable activity ledger</div>
            <h1 className="mt-1 text-xl font-medium text-[#E8EDF1]">LOG</h1>
            <p className="mt-1 text-[11px] text-[#66717B]">NARS Evidence·판단·현재 포지션·종료 거래·시스템 상태를 클릭 가능한 하나의 시간축으로 봅니다.</p>
          </div>
          <button onClick={() => void load()} className="flex items-center gap-2 border border-white/[0.08] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#7B8791] hover:text-[#D9E0E5]">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <section className="mb-4 border border-[#43D9E6]/15 bg-[#071015] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-[#6ECBD4]" /><span className="font-mono text-[8px] uppercase tracking-[0.17em] text-[#7ED5DC]">AI Activity Brief</span></div>
            <button onClick={() => void explain()} disabled={briefing || !events.length} className="border border-[#43D9E6]/20 px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#82CDD4] disabled:opacity-40">
              {briefing ? 'Reading log…' : 'Explain recent activity'}
            </button>
          </div>
          <div className="mt-3 whitespace-pre-wrap text-[11px] leading-6 text-[#AAB5BD]">
            {brief || '최근 로그를 기준으로 Black Oracle이 무엇을 했고 왜 했는지 설명합니다. 각 항목을 눌러 원본 Trace와 판단 근거를 검증할 수 있습니다.'}
          </div>
        </section>

        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center border border-white/[0.07] bg-[#070B10] px-3">
            <Search className="h-3.5 w-3.5 text-[#4F5A64]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="strategy, market, reason, evidence…" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[11px] text-[#C6CED4] outline-none placeholder:text-[#414A53]" />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto"><Filter className="mr-1 h-3 w-3 shrink-0 text-[#4F5A64]" />{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`shrink-0 border px-2.5 py-2 font-mono text-[7px] uppercase tracking-[0.1em] ${filter === item ? 'border-[#43D9E6]/30 bg-[#43D9E6]/[0.05] text-[#83D2D9]' : 'border-white/[0.06] text-[#58636D]'}`}>{item}</button>)}</div>
        </div>

        <section className="border border-white/[0.07] bg-[#070B10]">
          <div className="grid grid-cols-[78px_72px_1fr_20px] border-b border-white/[0.06] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.14em] text-[#46515B] md:grid-cols-[130px_90px_180px_1fr_20px]">
            <span>Time</span><span>Type</span><span className="hidden md:block">Event</span><span>Trace</span><span />
          </div>
          <div className="divide-y divide-white/[0.045]">
            {visible.map((event) => (
              <button key={event.id} onClick={() => setSelected(event)} className="grid w-full grid-cols-[78px_72px_1fr_20px] gap-2 px-3 py-3 text-left transition hover:bg-white/[0.025] md:grid-cols-[130px_90px_180px_1fr_20px] md:items-start">
                <div className="font-mono text-[7px] leading-5 text-[#56616B]">{time(event.timestamp)}</div>
                <div className="font-mono text-[7px] leading-5 text-[#76C8D0]">{event.type}</div>
                <div className="hidden text-[10px] font-medium leading-5 text-[#C8D0D6] md:block">{event.title}</div>
                <div>
                  <div className="text-[10px] leading-5 text-[#9BA6AE] md:hidden">{event.title}</div>
                  <div className="text-[10px] leading-5 text-[#7C8790]">{event.detail}</div>
                  {event.meta && <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.08em] text-[#49535C]">{event.meta}</div>}
                </div>
                <ChevronRight className="mt-1 h-3.5 w-3.5 text-[#46515B]" />
              </button>
            ))}
            {!visible.length && <div className="px-4 py-12 text-center text-[11px] text-[#59646E]">조건에 맞는 로그가 없습니다.</div>}
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[120] flex justify-end bg-black/55 backdrop-blur-[2px]" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-[560px] overflow-y-auto border-l border-white/[0.09] bg-[#070B10] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[0.07] bg-[#070B10]/95 px-5 py-4 backdrop-blur">
              <div>
                <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#61C9D3]">{selected.type} TRACE · {time(selected.timestamp)}</div>
                <h2 className="mt-2 text-base font-medium text-[#E2E7EA]">{selected.title}</h2>
                <div className="mt-1 text-[10px] leading-5 text-[#75818A]">{selected.detail}</div>
              </div>
              <button onClick={() => setSelected(null)} className="ml-4 border border-white/[0.07] p-2 text-[#67737D] hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">
              {selected.meta && <div className="mb-4 border border-[#43D9E6]/10 bg-[#43D9E6]/[0.025] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[#72BAC1]">{selected.meta}</div>}
              <div className="space-y-0 border border-white/[0.07]">
                {Object.entries(selected.trace ?? {}).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[130px_1fr] gap-3 border-b border-white/[0.05] px-3 py-3 last:border-0">
                    <div className="font-mono text-[7px] uppercase tracking-[0.09em] text-[#53606A]">{key}</div>
                    <div className="min-w-0 break-words text-[10px] leading-5 text-[#9EAAB2]">{renderValue(value)}</div>
                  </div>
                ))}
              </div>
              {!selected.trace && <div className="border border-white/[0.07] p-6 text-center text-[10px] text-[#58636C]">이 이벤트에는 추가 Trace가 기록되지 않았습니다.</div>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
