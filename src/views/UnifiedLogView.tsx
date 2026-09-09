import React, { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronRight, Filter, RefreshCw, Search, X } from 'lucide-react';

type CanonicalType = 'SYSTEM' | 'EVIDENCE' | 'STRATEGY' | 'COUNCIL' | 'DECISION' | 'RISK' | 'ORDER' | 'TRADE' | 'OUTCOME' | 'EXPERIMENT' | 'AI';
type EventType = 'ALL' | CanonicalType;

type LedgerEvent = {
  id: string;
  eventKey: string;
  occurredAt: number;
  recordedAt: number;
  runtimeId: string | null;
  eventType: CanonicalType;
  eventName: string;
  market: string | null;
  strategyId: string | null;
  strategyVersion: string | null;
  action: string | null;
  summary: string;
  reason: string | null;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  authority: string;
  executionAuthority: boolean;
  source: string;
  trace: Record<string, unknown>;
  links: Record<string, unknown>;
  schemaVersion: number;
};

type EventsPayload = {
  success?: boolean;
  canonical?: boolean;
  appendOnly?: boolean;
  coverage?: string;
  source?: string;
  count?: number;
  events?: LedgerEvent[];
  error?: string;
};

const filters: EventType[] = ['ALL', 'TRADE', 'DECISION', 'EVIDENCE', 'STRATEGY', 'COUNCIL', 'RISK', 'EXPERIMENT', 'AI', 'SYSTEM'];

const time = (timestamp: number) => timestamp > 0
  ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(timestamp)
  : 'TIME —';

const typeTone = (type: CanonicalType) => {
  if (type === 'TRADE' || type === 'OUTCOME') return 'text-[#77B9A5]';
  if (type === 'RISK') return 'text-[#D2A86D]';
  if (type === 'AI' || type === 'COUNCIL') return 'text-[#9B9FE4]';
  if (type === 'EVIDENCE') return 'text-[#6FCAD2]';
  if (type === 'STRATEGY' || type === 'EXPERIMENT') return 'text-[#B6A4D8]';
  return 'text-[#76C8D0]';
};

const severityTone = (severity: LedgerEvent['severity']) => {
  if (severity === 'CRITICAL' || severity === 'ERROR') return 'text-[#D66565]';
  if (severity === 'WARN') return 'text-[#C7A96B]';
  return 'text-[#59656F]';
};

export const UnifiedLogView: React.FC = () => {
  const [payload, setPayload] = useState<EventsPayload | null>(null);
  const [filter, setFilter] = useState<EventType>('ALL');
  const [query, setQuery] = useState('');
  const [brief, setBrief] = useState('');
  const [briefing, setBriefing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LedgerEvent | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/events?limit=400', { cache: 'no-store' });
      setPayload(await response.json() as EventsPayload);
    } catch {
      setPayload({ success: false, canonical: true, appendOnly: true, events: [], error: 'Canonical Event Ledger API unavailable.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', load);
    };
  }, []);

  const events = payload?.events ?? [];
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (filter !== 'ALL' && event.eventType !== filter) return false;
      if (!needle) return true;
      return [event.eventType, event.eventName, event.market, event.strategyId, event.action, event.summary, event.reason, event.source, event.authority]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [events, filter, query]);

  const explain = async () => {
    setBriefing(true);
    try {
      const response = await fetch('/api/activity-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await response.json();
      setBrief(data.brief || '최근 활동을 설명할 수 없습니다.');
    } catch {
      setBrief('Canonical Event Ledger 기반 활동 요약 API에 연결하지 못했습니다. 원본 원장은 아래에서 계속 확인할 수 있습니다.');
    } finally {
      setBriefing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-24 pt-4 md:px-6 lg:pb-8 xl:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div>
            <div className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#43D9E6]">Canonical append-only event ledger</div>
            <h1 className="mt-1 text-xl font-medium text-[#E8EDF1]">LOG</h1>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#66717B]">Cutover 이후 Evidence·Strategy·Council·Decision·Risk·Trade·Experiment·AI·System 활동을 서버 원장 하나에서 읽습니다. 브라우저가 이벤트를 합성하지 않습니다.</p>
          </div>
          <button onClick={() => void load()} className="flex items-center gap-2 border border-white/[0.08] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#7B8791] hover:text-[#D9E0E5]">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-px border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
          <StatusCell label="Source" value={payload?.source || 'black_oracle_events'} />
          <StatusCell label="Mode" value={payload?.appendOnly ? 'APPEND-ONLY' : 'UNKNOWN'} />
          <StatusCell label="Coverage" value={payload?.coverage || 'CUTOVER_FORWARD'} />
          <StatusCell label="Events" value={String(events.length)} />
        </div>

        <section className="mb-4 border border-[#43D9E6]/15 bg-[#071015] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-[#6ECBD4]" /><span className="font-mono text-[8px] uppercase tracking-[0.17em] text-[#7ED5DC]">AI Activity Brief · canonical source</span></div>
            <button onClick={() => void explain()} disabled={briefing || !events.length} className="border border-[#43D9E6]/20 px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#82CDD4] disabled:opacity-40">
              {briefing ? 'Reading ledger…' : 'Explain recent activity'}
            </button>
          </div>
          <div className="mt-3 whitespace-pre-wrap text-[11px] leading-6 text-[#AAB5BD]">
            {brief || '서버가 최근 canonical events를 직접 읽어 Black Oracle이 무엇을 했고 왜 했는지 설명합니다. 클라이언트가 요약용 이벤트를 제공하지 않습니다.'}
          </div>
        </section>

        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center border border-white/[0.07] bg-[#070B10] px-3">
            <Search className="h-3.5 w-3.5 text-[#4F5A64]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="strategy, market, council, risk, evidence, reason…" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[11px] text-[#C6CED4] outline-none placeholder:text-[#414A53]" />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto"><Filter className="mr-1 h-3 w-3 shrink-0 text-[#4F5A64]" />{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`shrink-0 border px-2.5 py-2 font-mono text-[7px] uppercase tracking-[0.1em] ${filter === item ? 'border-[#43D9E6]/30 bg-[#43D9E6]/[0.05] text-[#83D2D9]' : 'border-white/[0.06] text-[#58636D]'}`}>{item}</button>)}</div>
        </div>

        {payload?.error && <div className="mb-3 border border-[#D66565]/20 bg-[#D66565]/[0.04] px-3 py-2 text-[10px] text-[#C98787]">{payload.error}</div>}

        <section className="border border-white/[0.07] bg-[#070B10]">
          <div className="grid grid-cols-[78px_72px_1fr_20px] border-b border-white/[0.06] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.14em] text-[#46515B] md:grid-cols-[130px_90px_210px_1fr_20px]">
            <span>Time</span><span>Type</span><span className="hidden md:block">Event</span><span>Trace</span><span />
          </div>
          <div className="divide-y divide-white/[0.045]">
            {visible.map((event) => (
              <button key={event.id || event.eventKey} onClick={() => setSelected(event)} className="grid w-full grid-cols-[78px_72px_1fr_20px] gap-2 px-3 py-3 text-left transition hover:bg-white/[0.025] md:grid-cols-[130px_90px_210px_1fr_20px] md:items-start">
                <div className="font-mono text-[7px] leading-5 text-[#56616B]">{time(event.occurredAt)}</div>
                <div className={`font-mono text-[7px] leading-5 ${typeTone(event.eventType)}`}>{event.eventType}</div>
                <div className="hidden md:block">
                  <div className="text-[9px] font-medium leading-5 text-[#C8D0D6]">{event.eventName}</div>
                  <div className={`mt-0.5 font-mono text-[6px] uppercase tracking-[0.08em] ${severityTone(event.severity)}`}>{event.severity} · {event.source}</div>
                </div>
                <div>
                  <div className="text-[10px] leading-5 text-[#B9C2C9]">{event.market ? `${event.market} · ` : ''}{event.summary}</div>
                  <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#68747D]">{event.reason || 'No separate reason recorded.'}</div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[6px] uppercase tracking-[0.08em] text-[#4F5A64]">
                    {event.action && <span>action {event.action}</span>}
                    {event.strategyId && <span>strategy {event.strategyId}</span>}
                    <span>authority {event.authority}</span>
                    <span className={event.executionAuthority ? 'text-[#C7A96B]' : ''}>execution {event.executionAuthority ? 'YES' : 'NO'}</span>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-3 w-3 text-[#3F4952]" />
              </button>
            ))}
            {!visible.length && <div className="px-4 py-12 text-center text-[10px] text-[#58636D]">{events.length ? '현재 필터와 일치하는 canonical event가 없습니다.' : 'Cutover 이후 첫 canonical event를 기다리고 있습니다.'}</div>}
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[180] flex justify-end bg-black/60" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-[620px] overflow-y-auto border-l border-white/[0.08] bg-[#070B10] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div>
                <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#58636D]">Canonical event</div>
                <div className="mt-1 font-mono text-[13px] text-[#E7ECEF]">{selected.eventName}</div>
                <div className="mt-1 break-all text-[10px] text-[#69757E]">{selected.eventKey}</div>
              </div>
              <button onClick={() => setSelected(null)} className="border border-white/[0.07] p-2 text-[#68737C]"><X className="h-3.5 w-3.5" /></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-px bg-white/[0.05] sm:grid-cols-4">
              <DetailCell label="Type" value={selected.eventType} />
              <DetailCell label="Severity" value={selected.severity} />
              <DetailCell label="Authority" value={selected.authority} />
              <DetailCell label="Execution" value={selected.executionAuthority ? 'YES' : 'NO'} />
            </div>

            <DetailBlock title="Summary" value={selected.summary} />
            <DetailBlock title="Reason" value={selected.reason || 'No separate reason recorded.'} />
            <JsonBlock title="Trace" value={selected.trace} />
            <JsonBlock title="Links" value={selected.links} />
            <JsonBlock title="Event metadata" value={{
              id: selected.id,
              eventKey: selected.eventKey,
              occurredAt: selected.occurredAt,
              recordedAt: selected.recordedAt,
              runtimeId: selected.runtimeId,
              market: selected.market,
              strategyId: selected.strategyId,
              strategyVersion: selected.strategyVersion,
              action: selected.action,
              source: selected.source,
              schemaVersion: selected.schemaVersion,
            }} />
          </aside>
        </div>
      )}
    </div>
  );
};

const StatusCell = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#070B10] p-3"><div className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#4F5A64]">{label}</div><div className="mt-1.5 truncate font-mono text-[9px] text-[#AAB4BC]">{value}</div></div>
);

const DetailCell = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#080C11] p-3"><div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5A64]">{label}</div><div className="mt-1.5 font-mono text-[9px] text-[#B8C1C8]">{value}</div></div>
);

const DetailBlock = ({ title, value }: { title: string; value: string }) => (
  <section className="mt-4 border border-white/[0.07] bg-[#05080C]">
    <div className="border-b border-white/[0.06] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#5F6A74]">{title}</div>
    <div className="whitespace-pre-wrap p-3 text-[10px] leading-5 text-[#8B969F]">{value}</div>
  </section>
);

const JsonBlock = ({ title, value }: { title: string; value: unknown }) => (
  <section className="mt-4 border border-white/[0.07] bg-[#05080C]">
    <div className="border-b border-white/[0.06] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#5F6A74]">{title}</div>
    <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words p-3 font-mono text-[9px] leading-5 text-[#82909A]">{JSON.stringify(value, null, 2)}</pre>
  </section>
);
