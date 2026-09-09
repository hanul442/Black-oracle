import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  CircleDot,
  Database,
  ExternalLink,
  GitCommitHorizontal,
  Network,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { auth } from '../store';

type NarsSection = 'documents' | 'events' | 'debt' | 'errors';

type NarsPayload = {
  generatedAt?: string;
  partial?: boolean;
  data?: {
    documents?: { count?: number; lagSeconds?: number | null; items?: any[]; summary?: any };
    events?: { count?: number; items?: any[] };
    metrics?: { metrics?: { shadow?: any; cluster?: any } };
    debt?: { readiness?: any; items?: any[] };
    errors?: { count?: number; items?: any[] };
  };
  errors?: Array<{ view: string; error: string }>;
};

const sections: Array<{ id: NarsSection; label: string; icon: React.FC<any> }> = [
  { id: 'documents', label: 'NEWS', icon: Newspaper },
  { id: 'events', label: 'EVENTS', icon: Network },
  { id: 'debt', label: 'CUTOVER DEBT', icon: ShieldCheck },
  { id: 'errors', label: 'ERRORS', icon: AlertCircle },
];

const formatStamp = (value?: string) => {
  if (!value) return 'UNSTAMPED';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const statusTone = (status?: string) => {
  if (status === 'PASS' || status === 'ACTIVE' || status === 'HEALTHY') return 'text-[#72B6A0]';
  if (status === 'BLOCKED' || status === 'FAILED' || status === 'DOWN') return 'text-[#D66565]';
  return 'text-[#C7A96B]';
};

export const NarsActivityLog: React.FC<{ onShowEvidence: () => void }> = ({ onShowEvidence }) => {
  const [section, setSection] = useState<NarsSection>('documents');
  const [payload, setPayload] = useState<NarsPayload | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Black Oracle login is required.');
      const token = await user.getIdToken();
      const response = await fetch('/api/nars-log?limit=80', {
        headers: { authorization: 'Bearer ' + token },
      });
      const next = await response.json();
      if (!response.ok || !next.success) throw new Error(next.error || 'NARS log could not be loaded.');
      setPayload(next);
      if (next.partial) setError('Some NARS log surfaces are temporarily unavailable.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'NARS log could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const data = payload?.data;
  const shadow = data?.metrics?.metrics?.shadow ?? {};
  const cluster = data?.metrics?.metrics?.cluster ?? {};
  const readiness = data?.debt?.readiness ?? {};
  const debtItems = data?.debt?.items ?? [];
  const blockedGates = ['pipeline', 'calibration', 'comparator', 'evidence']
    .filter((gate) => readiness?.[gate + '_status'] === 'BLOCKED').length;
  const pipelineStatus = readiness?.pipeline_status ?? 'UNKNOWN';
  const latestLag = data?.documents?.lagSeconds;

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source =
      section === 'documents' ? data?.documents?.items
        : section === 'events' ? data?.events?.items
          : section === 'debt' ? debtItems
            : data?.errors?.items;
    if (!normalized) return source ?? [];
    return (source ?? []).filter((item: any) => JSON.stringify(item).toLowerCase().includes(normalized));
  }, [data, debtItems, query, section]);

  const sourceCounts = data?.documents?.summary?.sources ?? {};
  const sourceEntries = Object.entries(sourceCounts)
    .sort(([, left], [, right]) => number(right) - number(left))
    .slice(0, 8);
  const totalDocuments = number(shadow.total_documents || cluster.documents);
  const totalEvents = number(cluster.events);
  const recentErrors = number(data?.errors?.count);

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-40 pt-6 text-[#E9EDF1] md:px-8 md:pb-28 md:pt-8">
      <div className="mx-auto max-w-[1380px]">
        <header className="mb-5 flex flex-col gap-5 border-b border-white/[0.06] pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-1 border border-white/[0.06] bg-[#070A0E] p-1">
              <button onClick={onShowEvidence} className="px-3 py-2 font-mono text-[7px] uppercase tracking-[0.16em] text-[#56616C] transition hover:text-[#AEB7C0]">
                EVIDENCE
              </button>
              <button className="border border-[#43D9E6]/25 bg-[#43D9E6]/[0.04] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.16em] text-[#79CED5]">
                NARS LIVE
              </button>
            </div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.24em] text-[#43D9E6]">
              <GitCommitHorizontal className="h-3.5 w-3.5" />
              Intelligence ingestion log
            </div>
            <h1 className="text-2xl font-medium tracking-[-0.04em] md:text-3xl">NARS Activity</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#77818C]">
              Live collection, event clustering, evidence debt, and ingestion failures. Data refreshes automatically every minute.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px border border-white/[0.06] bg-white/[0.045] sm:grid-cols-4">
            <HeaderMetric label="DOCUMENTS" value={totalDocuments.toLocaleString()} />
            <HeaderMetric label="EVENTS" value={totalEvents.toLocaleString()} />
            <HeaderMetric label="PIPELINE" value={pipelineStatus} positive={pipelineStatus === 'PASS'} alert={pipelineStatus === 'BLOCKED'} />
            <HeaderMetric label="BLOCKED GATES" value={blockedGates} alert={blockedGates > 0} />
          </div>
        </header>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {sections.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSection(item.id);
                    setExpanded(null);
                  }}
                  className={'flex shrink-0 items-center gap-2 border px-3 py-2 font-mono text-[7px] uppercase tracking-[0.16em] transition ' + (
                    section === item.id
                      ? 'border-[#43D9E6]/25 bg-[#43D9E6]/[0.035] text-[#79CED5]'
                      : 'border-white/[0.06] text-[#59636D] hover:text-[#AEB7C0]'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <label className="flex h-9 min-w-0 flex-1 items-center border border-white/[0.07] bg-[#080C11] px-3 lg:w-[300px]">
              <Search className="mr-2 h-3.5 w-3.5 text-[#59636D]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search NARS activity…"
                className="min-w-0 flex-1 bg-transparent text-[11px] text-[#CBD2D9] outline-none placeholder:text-[#46505A]"
              />
            </label>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center border border-white/[0.07] text-[#65717C] transition hover:border-[#43D9E6]/20 hover:text-[#BFC7CE] disabled:opacity-40"
              aria-label="Refresh NARS activity"
            >
              <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin text-[#43D9E6]' : '')} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 border border-[#D66565]/20 bg-[#D66565]/[0.035] px-3 py-2.5 text-[10px] text-[#C98282]">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="border border-white/[0.07] bg-[#080C11]">
            <PanelHeader
              eyebrow={section === 'documents' ? 'Collection stream' : section === 'events' ? 'Cluster stream' : section === 'debt' ? 'Readiness register' : 'Failure stream'}
              title={section === 'documents' ? 'Incoming news' : section === 'events' ? 'Detected events' : section === 'debt' ? 'Cutover evidence debt' : 'Ingestion errors'}
              detail={loading && !payload ? 'loading' : visibleRows.length + ' entries'}
            />

            <div>
              {visibleRows.map((item: any, index: number) => {
                const key = String(item.id ?? item.event_id ?? item.debt_key ?? index);
                return (
                  <NarsRow
                    key={key}
                    item={item}
                    section={section}
                    expanded={expanded === key}
                    onToggle={() => setExpanded(expanded === key ? null : key)}
                    index={index}
                  />
                );
              })}

              {!loading && !visibleRows.length && (
                <div className="px-5 py-16 text-center">
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#59636D]">No matching NARS activity</div>
                  <p className="mt-2 text-[11px] text-[#46505A]">Change the filter or wait for the next collector cycle.</p>
                </div>
              )}
              {loading && !payload && (
                <div className="flex items-center justify-center gap-2 px-5 py-16 font-mono text-[8px] uppercase tracking-[0.18em] text-[#59636D]">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#43D9E6]" />
                  Loading live field
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
            <section className="border border-white/[0.07] bg-[#080C11]">
              <PanelHeader eyebrow="System pulse" title="Collector state" detail={formatStamp(payload?.generatedAt)} />
              <div className="grid grid-cols-2 gap-px bg-white/[0.045]">
                <MiniMetric label="LATEST LAG" value={latestLag == null ? '—' : Math.round(number(latestLag)) + 's'} />
                <MiniMetric label="RECENT ERRORS" value={recentErrors} warning={recentErrors > 0} />
                <MiniMetric label="V3 ONLY" value={number(shadow.v3_only)} warning={number(shadow.v3_only) > 0} />
                <MiniMetric label="BOTH SEEN" value={number(shadow.both_count)} />
              </div>
              <div className="flex items-center gap-2 border-t border-white/[0.05] px-4 py-3 font-mono text-[7px] uppercase tracking-[0.13em]">
                <CircleDot className={'h-3 w-3 ' + (pipelineStatus === 'PASS' ? 'text-[#72B6A0]' : 'text-[#D66565]')} />
                <span className={statusTone(pipelineStatus)}>pipeline {pipelineStatus}</span>
                <span className="ml-auto text-[#46515B]">auto refresh 60s</span>
              </div>
            </section>

            <section className="border border-white/[0.07] bg-[#080C11]">
              <PanelHeader eyebrow="Current batch" title="Source distribution" detail="top sources" />
              <div>
                {sourceEntries.map(([source, count]) => (
                  <div key={source} className="flex items-center gap-3 border-b border-white/[0.045] px-4 py-3 last:border-0">
                    <Database className="h-3 w-3 text-[#4E5963]" />
                    <span className="min-w-0 flex-1 truncate text-[10px] text-[#8D97A1]">{source}</span>
                    <span className="font-mono text-[8px] tabular-nums text-[#59636D]">{String(count)}</span>
                  </div>
                ))}
                {!Object.keys(sourceCounts).length && (
                  <div className="p-6 text-center font-mono text-[7px] uppercase tracking-[0.15em] text-[#4F5963]">No source summary</div>
                )}
              </div>
            </section>

            <section className="border border-[#C7A96B]/15 bg-[#C7A96B]/[0.025] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#C7A96B]" />
                <div>
                  <div className="font-mono text-[7px] uppercase tracking-[0.15em] text-[#C7A96B]">Retirement invariant</div>
                  <p className="mt-2 text-[9px] leading-relaxed text-[#776D58]">
                    NARS v3 remains live. Readiness never triggers automatic retirement; separate human authorization is required.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

const NarsRow = ({ item, section, expanded, onToggle, index }: any) => {
  const document = section === 'documents';
  const event = section === 'events';
  const debt = section === 'debt';
  const stamp = item.last_seen_at || item.last_updated_at || item.generated_at || item.occurred_at;
  const title = document
    ? item.title
    : event
      ? item.title
      : debt
        ? (item.gate_family + ' / ' + item.debt_key)
        : (item.error_code || item.component || 'NARS error');
  const meta = document
    ? (item.source_name || item.source_key || item.ingest_origin)
    : event
      ? ((item.story_count || 0) + ' stories · ' + (item.source_count || 0) + ' sources')
      : debt
        ? ('current ' + String(item.current_value ?? '—') + ' / required ' + String(item.required_value ?? '—'))
        : (item.component || 'unknown component');
  const state = debt ? item.status : document ? (item.is_breaking ? 'BREAKING' : item.source_health || 'COLLECTED') : event ? (item.priority_band || item.status || 'EVENT') : (item.retryable ? 'RETRYABLE' : 'ERROR');
  const tone = debt ? statusTone(item.status) : section === 'errors' ? 'text-[#D66565]' : item.is_breaking || item.priority_band === 'FLASH' ? 'text-[#C7A96B]' : 'text-[#72B6A0]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.16) }}
      className="border-b border-white/[0.05] last:border-0"
    >
      <button onClick={onToggle} className="group flex w-full items-start gap-4 p-4 text-left transition hover:bg-white/[0.018] md:p-5">
        <span className={'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ' + (
          section === 'errors' || item.status === 'BLOCKED' ? 'bg-[#D66565]' : item.is_breaking ? 'bg-[#C7A96B]' : 'bg-[#5F9C8A]'
        )} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[6px] uppercase tracking-[0.13em]">
            <span className={tone}>{state}</span>
            <span className="text-[#3F4851]">·</span>
            <span className="text-[#59636D]">{formatStamp(stamp)}</span>
            {document && <><span className="text-[#3F4851]">·</span><span className="text-[#59636D]">{item.language || '—'}</span></>}
          </div>
          <h2 className="mt-2 text-[12px] font-medium leading-relaxed text-[#D2D8DE] md:text-[13px]">{title || 'Untitled'}</h2>
          <p className="mt-1.5 text-[9px] leading-relaxed text-[#68727C]">{meta}</p>
          {debt && item.next_action && <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#7C8791]">{item.next_action}</p>}
          {section === 'errors' && item.message && <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#9C6A6A]">{item.message}</p>}
        </div>
        <ChevronDown className={'mt-1 h-3.5 w-3.5 shrink-0 text-[#414A53] transition ' + (expanded ? 'rotate-180 text-[#43D9E6]' : 'group-hover:text-[#7A858F]')} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.045] bg-[#06090D] px-5 py-4 md:pl-10">
              <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap break-words font-mono text-[8px] leading-relaxed text-[#68727C]">
                {JSON.stringify(item, null, 2)}
              </pre>
              {document && item.canonical_url && (
                <a
                  href={item.canonical_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.13em] text-[#63B7C0] hover:text-[#8CD7DE]"
                >
                  Open source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const HeaderMetric = ({ label, value, alert, positive }: any) => (
  <div className="bg-[#080C11] px-3 py-3">
    <div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#4F5963]">{label}</div>
    <div className={'mt-1 text-sm font-light tabular-nums ' + (positive ? 'text-[#70A493]' : alert ? 'text-[#D66565]' : 'text-[#C9D0D7]')}>{value}</div>
  </div>
);

const MiniMetric = ({ label, value, warning }: any) => (
  <div className="bg-[#06090D] p-3">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</div>
    <div className={'mt-1 text-base font-light tabular-nums ' + (warning ? 'text-[#D66565]' : 'text-[#C5CCD2]')}>{value}</div>
  </div>
);

const PanelHeader = ({ eyebrow, title, detail }: any) => (
  <div className="flex items-end justify-between gap-4 border-b border-white/[0.06] px-4 py-3.5">
    <div>
      <div className="font-mono text-[6px] uppercase tracking-[0.18em] text-[#59636D]">{eyebrow}</div>
      <div className="mt-1 text-sm font-medium text-[#CBD2D9]">{title}</div>
    </div>
    <span className="font-mono text-[7px] uppercase tracking-[0.13em] text-[#4F5963]">{detail}</span>
  </div>
);
