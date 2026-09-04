import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Filter,
  GitCommitHorizontal,
  Link2,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';

const filters = ['all', 'supporting', 'contradicting', 'neutral', 'pending'] as const;

const formatStamp = (value?: string) => {
  if (!value) return 'UNSTAMPED';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const LedgerView: React.FC = () => {
  const { evidence, sources, hypotheses, scenarios, setSelectedEntity, setCurrentView } = useAppContext() as any;
  const [filter, setFilter] = useState<(typeof filters)[number]>('all');
  const [query, setQuery] = useState('');

  const sourceById = useMemo(() => new Map((sources || []).map((source: any) => [source.id, source])), [sources]);
  const hypothesisById = useMemo(() => new Map((hypotheses || []).map((item: any) => [item.id, item])), [hypotheses]);
  const scenarioById = useMemo(() => new Map((scenarios || []).map((item: any) => [item.id, item])), [scenarios]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (evidence || [])
      .map((item: any) => {
        const source: any = sourceById.get(item.sourceId);
        const hypothesis: any = hypothesisById.get(item.linkedHypothesisId);
        const scenario: any = scenarioById.get(item.linkedScenarioBranchId);
        const probabilityChange = Number(item.probabilityChange || 0);
        const confidenceChange = Number(item.confidenceChange || 0);
        const influence = Math.abs(probabilityChange || confidenceChange) * (Number(item.reliability || 0) / 100) * Math.max(Number(item.evidenceWeight || 1), 1);
        const stampedAt = source?.collectedAt || source?.publishedAt || '';
        return { item, source, hypothesis, scenario, probabilityChange, confidenceChange, influence, stampedAt };
      })
      .filter(({ item }: any) => filter === 'all' || item.evidenceType === filter)
      .filter(({ item, source, hypothesis, scenario }: any) => {
        if (!normalizedQuery) return true;
        const haystack = `${item.title || ''} ${item.summary || ''} ${source?.sourceName || ''} ${source?.title || ''} ${hypothesis?.title || ''} ${scenario?.title || ''}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a: any, b: any) => {
        const timeA = a.stampedAt ? new Date(a.stampedAt).getTime() : 0;
        const timeB = b.stampedAt ? new Date(b.stampedAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return b.influence - a.influence;
      });
  }, [evidence, filter, query, sourceById, hypothesisById, scenarioById]);

  const verified = (evidence || []).filter((item: any) => Number(item.reliability || 0) >= 70).length;
  const contradictions = (evidence || []).filter((item: any) => item.evidenceType === 'contradicting').length;
  const averageReliability = evidence?.length
    ? Math.round(evidence.reduce((sum: number, item: any) => sum + Number(item.reliability || 0), 0) / evidence.length)
    : 0;
  const netProbabilityPressure = Math.round(
    (evidence || []).reduce((sum: number, item: any) => sum + Number(item.probabilityChange || 0), 0) * 10,
  ) / 10;
  const unlinked = (evidence || []).filter((item: any) => !item.linkedHypothesisId && !item.linkedScenarioBranchId).length;
  const impactQueue = [...rows].sort((a: any, b: any) => b.influence - a.influence).slice(0, 5);

  const openEvidence = (item: any) => {
    setSelectedEntity({ type: 'evidence', id: item.id });
    setCurrentView('watchlist');
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-40 pt-6 text-[#E9EDF1] md:px-8 md:pb-28 md:pt-8">
      <div className="mx-auto max-w-[1380px]">
        <header className="mb-5 flex flex-col gap-5 border-b border-white/[0.06] pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.24em] text-[#C7A96B]">
              <GitCommitHorizontal className="h-3.5 w-3.5" />
              Decision audit layer
            </div>
            <h1 className="text-2xl font-medium tracking-[-0.04em] md:text-3xl">Ledger</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#77818C]">
              Trace each evidence item from source to analytical role to model impact. The ledger exists to explain why the forecast changed — not simply to store citations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px border border-white/[0.06] bg-white/[0.045] sm:grid-cols-4">
            <HeaderMetric label="VERIFIED" value={verified} />
            <HeaderMetric label="CONTRADICTIONS" value={contradictions} alert={contradictions > 0} />
            <HeaderMetric label="AVG RELIABILITY" value={`${averageReliability}%`} />
            <HeaderMetric
              label="NET FORECAST Δ"
              value={`${netProbabilityPressure > 0 ? '+' : ''}${netProbabilityPressure}`}
              positive={netProbabilityPressure > 0}
              alert={netProbabilityPressure < 0}
            />
          </div>
        </header>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`shrink-0 border px-3 py-2 font-mono text-[7px] uppercase tracking-[0.16em] transition ${
                  filter === item
                    ? 'border-[#C7A96B]/30 bg-[#C7A96B]/[0.04] text-[#D8C797]'
                    : 'border-white/[0.06] text-[#59636D] hover:text-[#AEB7C0]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="flex h-9 min-w-0 items-center border border-white/[0.07] bg-[#080C11] px-3 lg:w-[330px]">
            <Search className="mr-2 h-3.5 w-3.5 text-[#59636D]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search claims, sources, theses…"
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#CBD2D9] outline-none placeholder:text-[#46505A]"
            />
            <Filter className="ml-2 h-3 w-3 text-[#46505A]" />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="border border-white/[0.07] bg-[#080C11]">
            <PanelHeader eyebrow="Audit stream" title="Evidence → decision impact" detail={`${rows.length} entries`} />
            <div>
              {rows.map((row: any, index: number) => {
                const { item, source, hypothesis, scenario, probabilityChange, confidenceChange, stampedAt } = row;
                const change = probabilityChange || confidenceChange;
                const roleTone =
                  item.evidenceType === 'contradicting'
                    ? '#D66565'
                    : item.evidenceType === 'supporting'
                      ? '#6EA999'
                      : item.evidenceType === 'pending'
                        ? '#C7A96B'
                        : '#7C8791';

                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.025, 0.25) }}
                    onClick={() => openEvidence(item)}
                    className="group relative block w-full border-b border-white/[0.05] p-4 text-left transition last:border-b-0 hover:bg-white/[0.018] md:p-5"
                  >
                    <div className="absolute bottom-0 left-[21px] top-0 w-px bg-white/[0.045] md:left-[25px]" />
                    <div className="relative flex gap-4 md:gap-5">
                      <div className="relative z-10 mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#080C11]">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: roleTone }} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 font-mono text-[6px] uppercase tracking-[0.14em]">
                              <span style={{ color: roleTone }}>{item.evidenceType || 'neutral'}</span>
                              <span className="text-[#434C55]">·</span>
                              <span className="flex items-center gap-1 text-[#59636D]"><Clock3 className="h-2.5 w-2.5" />{formatStamp(stampedAt)}</span>
                              <span className="text-[#434C55]">·</span>
                              <span className={Number(item.reliability || 0) >= 70 ? 'text-[#C7A96B]' : 'text-[#59636D]'}>REL {Math.round(item.reliability || 0)}</span>
                            </div>
                            <h2 className="mt-2 text-[12px] font-medium leading-relaxed text-[#D2D8DE] md:text-[13px]">{item.title}</h2>
                            {item.summary && <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-[#68727C]">{item.summary}</p>}
                          </div>

                          <div className="flex shrink-0 items-center gap-3 sm:block sm:text-right">
                            <div className={`text-base font-light tabular-nums ${change > 0 ? 'text-[#76AA9A]' : change < 0 ? 'text-[#D66565]' : 'text-[#7C8791]'}`}>
                              {change > 0 ? '+' : ''}{change || 0}
                            </div>
                            <div className="font-mono text-[6px] uppercase tracking-[0.11em] text-[#4C5660]">{probabilityChange ? 'scenario Δ' : 'confidence Δ'}</div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 border-t border-white/[0.045] pt-3 sm:grid-cols-2">
                          <TraceItem label="SOURCE" value={source?.sourceName || source?.title || 'Unknown source'} meta={source?.sourceType || 'source'} />
                          <TraceItem label="LINKED DECISION" value={scenario?.title || hypothesis?.title || 'Unlinked'} meta={scenario ? 'scenario' : hypothesis ? 'hypothesis' : 'needs linkage'} warning={!scenario && !hypothesis} />
                        </div>
                      </div>

                      <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[#414A53] transition group-hover:text-[#C7A96B]" />
                    </div>
                  </motion.button>
                );
              })}

              {!rows.length && (
                <div className="px-5 py-16 text-center">
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#59636D]">No matching ledger entries</div>
                  <p className="mt-2 text-[11px] text-[#46505A]">Change the filter or synchronize new evidence.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
            <section className="border border-white/[0.07] bg-[#080C11]">
              <PanelHeader eyebrow="Impact queue" title="What moved the model most" detail="top 5" />
              <div>
                {impactQueue.map((row: any, index: number) => {
                  const change = row.probabilityChange || row.confidenceChange;
                  return (
                    <button
                      key={row.item.id}
                      onClick={() => openEvidence(row.item)}
                      className="flex w-full items-start gap-3 border-b border-white/[0.05] p-3.5 text-left transition last:border-b-0 hover:bg-white/[0.018]"
                    >
                      <span className="font-mono text-[7px] text-[#4F5963]">{String(index + 1).padStart(2, '0')}</span>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-[10px] leading-relaxed text-[#AEB7C0]">{row.item.title}</div>
                        <div className="mt-1.5 flex items-center justify-between gap-3 font-mono text-[6px] uppercase tracking-[0.12em]">
                          <span className="truncate text-[#4F5963]">{row.source?.sourceName || 'Unknown'}</span>
                          <span className={change > 0 ? 'text-[#6FA492]' : change < 0 ? 'text-[#C36B6B]' : 'text-[#59636D]'}>{change > 0 ? '+' : ''}{change || 0}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!impactQueue.length && <div className="p-6 text-center font-mono text-[7px] uppercase tracking-[0.15em] text-[#4F5963]">No impact data</div>}
              </div>
            </section>

            <section className="border border-white/[0.07] bg-[#080C11] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[6px] uppercase tracking-[0.16em] text-[#59636D]">Ledger integrity</div>
                  <div className="mt-1 text-sm text-[#C8CFD5]">Linkage & provenance</div>
                </div>
                {unlinked === 0 ? <CheckCircle2 className="h-4 w-4 text-[#6CA08F]" /> : <TriangleAlert className="h-4 w-4 text-[#C7A96B]" />}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-px bg-white/[0.045]">
                <IntegrityMetric label="UNLINKED" value={unlinked} warning={unlinked > 0} />
                <IntegrityMetric label="SOURCES" value={(sources || []).length} />
              </div>
              <p className="mt-3 text-[9px] leading-relaxed text-[#59636D]">
                A high-quality ledger preserves the original source and an explicit link to the hypothesis or scenario that the evidence can change.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};

const HeaderMetric = ({ label, value, alert, positive }: any) => (
  <div className="bg-[#080C11] px-3 py-3">
    <div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#4F5963]">{label}</div>
    <div className={`mt-1 text-sm font-light tabular-nums ${positive ? 'text-[#70A493]' : alert ? 'text-[#D66565]' : 'text-[#C9D0D7]'}`}>{value}</div>
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

const TraceItem = ({ label, value, meta, warning }: any) => (
  <div className="min-w-0 border border-white/[0.045] bg-[#06090D] px-3 py-2.5">
    <div className="flex items-center gap-1.5 font-mono text-[6px] uppercase tracking-[0.13em] text-[#4F5963]">
      <Link2 className="h-2.5 w-2.5" />
      {label}
    </div>
    <div className={`mt-1.5 truncate text-[9px] ${warning ? 'text-[#C7A96B]' : 'text-[#8D97A1]'}`}>{value}</div>
    <div className="mt-1 font-mono text-[6px] uppercase tracking-[0.1em] text-[#444E57]">{meta}</div>
  </div>
);

const IntegrityMetric = ({ label, value, warning }: any) => (
  <div className="bg-[#06090D] p-3">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</div>
    <div className={`mt-1 text-lg font-light tabular-nums ${warning ? 'text-[#C7A96B]' : 'text-[#C5CCD2]'}`}>{value}</div>
  </div>
);
