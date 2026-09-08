import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Filter, RefreshCw, Search } from 'lucide-react';
import { useAppContext } from '../store';

type EventType = 'ALL' | 'TRADE' | 'DECISION' | 'EVIDENCE' | 'SIGNAL' | 'SYSTEM';

type LogEvent = {
  id: string;
  timestamp: number;
  type: Exclude<EventType, 'ALL'>;
  title: string;
  detail: string;
  meta?: string;
};

type StatusPayload = {
  success?: boolean;
  available?: boolean;
  status?: string;
  now?: number;
  checkpoint?: { savedAt?: number; reason?: string };
  decisionTape?: Array<{
    timestamp: number;
    market: string;
    decision: string;
    regime?: string | null;
    oracleTradeScore?: number | null;
    strategyDisposition?: string | null;
    riskDisposition?: string | null;
    primaryReason?: string | null;
    reasons?: string[];
  }>;
  recentTrades?: Array<{
    id: string;
    market: string;
    openedAt: number;
    closedAt: number;
    netPnl: number;
    returnPct: number;
    exitReason?: string;
    strategyVersion?: string | null;
  }>;
};

const filters: EventType[] = ['ALL', 'TRADE', 'DECISION', 'EVIDENCE', 'SIGNAL', 'SYSTEM'];

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

export const UnifiedLogView: React.FC = () => {
  const { evidence, signals, sources } = useAppContext() as any;
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [filter, setFilter] = useState<EventType>('ALL');
  const [query, setQuery] = useState('');
  const [brief, setBrief] = useState('');
  const [briefing, setBriefing] = useState(false);
  const [loading, setLoading] = useState(true);

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
        meta: [item.regime, item.oracleTradeScore == null ? null : `score ${item.oracleTradeScore.toFixed(1)}`, item.riskDisposition].filter(Boolean).join(' · '),
      });
    }

    for (const trade of payload?.recentTrades ?? []) {
      next.push({
        id: `trade-${trade.id}`,
        timestamp: trade.closedAt,
        type: 'TRADE',
        title: `${trade.market} · CLOSED`,
        detail: `${trade.returnPct >= 0 ? '+' : ''}${(trade.returnPct * 100).toFixed(2)}% · ${trade.exitReason || 'exit'} · PnL ${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(trade.netPnl)}`,
        meta: trade.strategyVersion || 'strategy version unavailable',
      });
    }

    for (const item of (sources ?? []).slice(0, 40)) {
      const timestamp = parseTime(item.collectedAt || item.publishedAt);
      if (!timestamp) continue;
      next.push({
        id: `source-${item.id}`,
        timestamp,
        type: 'EVIDENCE',
        title: item.title || 'Evidence collected',
        detail: item.summary || item.rawTextSnippet || item.sourceName || 'Evidence source recorded.',
        meta: [item.sourceName, item.reliability == null ? null : `rel ${item.reliability}`].filter(Boolean).join(' · '),
      });
    }

    for (const item of (signals ?? []).slice(0, 40)) {
      const timestamp = parseTime(item.detectedAt);
      if (!timestamp) continue;
      next.push({
        id: `signal-${item.id}`,
        timestamp,
        type: 'SIGNAL',
        title: item.title || 'Signal detected',
        detail: item.summary || 'Signal recorded.',
        meta: item.category || '',
      });
    }

    if (payload?.checkpoint?.savedAt) {
      next.push({
        id: `system-${payload.checkpoint.savedAt}`,
        timestamp: payload.checkpoint.savedAt,
        type: 'SYSTEM',
        title: `Runtime checkpoint · ${payload.status || 'UNKNOWN'}`,
        detail: payload.checkpoint.reason || 'Runtime state persisted.',
      });
    }

    return next.sort((a, b) => b.timestamp - a.timestamp).slice(0, 300);
  }, [payload, signals, sources]);

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
        body: JSON.stringify({ events: events.slice(0, 40) }),
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
            <div className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#43D9E6]">Unified event ledger</div>
            <h1 className="mt-1 text-xl font-medium text-[#E8EDF1]">LOG</h1>
            <p className="mt-1 text-[11px] text-[#66717B]">거래·결정·수집 정보·신호·시스템 이벤트를 하나의 시간축으로 봅니다.</p>
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
            {brief || '최근 로그를 기준으로 Black Oracle이 무엇을 했고 왜 했는지 설명합니다. 설명은 아래 원본 로그에서 검증할 수 있습니다.'}
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
          <div className="grid grid-cols-[78px_72px_1fr] border-b border-white/[0.06] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.14em] text-[#46515B] md:grid-cols-[130px_90px_180px_1fr]">
            <span>Time</span><span>Type</span><span className="hidden md:block">Event</span><span>Trace</span>
          </div>
          <div className="divide-y divide-white/[0.045]">
            {visible.map((event) => (
              <div key={event.id} className="grid grid-cols-[78px_72px_1fr] gap-2 px-3 py-3 md:grid-cols-[130px_90px_180px_1fr] md:items-start">
                <div className="font-mono text-[7px] leading-5 text-[#56616B]">{time(event.timestamp)}</div>
                <div className="font-mono text-[7px] leading-5 text-[#76C8D0]">{event.type}</div>
                <div className="hidden text-[10px] font-medium leading-5 text-[#C8D0D6] md:block">{event.title}</div>
                <div>
                  <div className="text-[10px] leading-5 text-[#9BA6AE] md:hidden">{event.title}</div>
                  <div className="text-[10px] leading-5 text-[#7C8790]">{event.detail}</div>
                  {event.meta && <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.08em] text-[#49535C]">{event.meta}</div>}
                </div>
              </div>
            ))}
            {!visible.length && <div className="px-4 py-12 text-center text-[11px] text-[#59646E]">조건에 맞는 로그가 없습니다.</div>}
          </div>
        </section>
      </div>
    </div>
  );
};
