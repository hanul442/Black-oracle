import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Filter, Link2, Search, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';

const filters = ['all', 'supporting', 'contradicting', 'neutral', 'pending'] as const;

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
      .filter((item: any) => filter === 'all' || item.evidenceType === filter)
      .filter((item: any) => {
        if (!normalizedQuery) return true;
        const source: any = sourceById.get(item.sourceId);
        const hypothesis: any = hypothesisById.get(item.linkedHypothesisId);
        const scenario: any = scenarioById.get(item.linkedScenarioBranchId);
        const haystack = `${item.title || ''} ${item.summary || ''} ${source?.sourceName || ''} ${hypothesis?.title || ''} ${scenario?.title || ''}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a: any, b: any) => ((b.reliability || 0) * (b.evidenceWeight || 0)) - ((a.reliability || 0) * (a.evidenceWeight || 0)));
  }, [evidence, filter, query, sourceById, hypothesisById, scenarioById]);

  const verified = (evidence || []).filter((item: any) => (item.reliability || 0) >= 70).length;
  const contradictions = (evidence || []).filter((item: any) => item.evidenceType === 'contradicting').length;
  const averageReliability = evidence?.length
    ? Math.round(evidence.reduce((sum: number, item: any) => sum + (item.reliability || 0), 0) / evidence.length)
    : 0;

  const openEvidence = (item: any) => {
    setSelectedEntity({ type: 'evidence', id: item.id });
    setCurrentView('watchlist');
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-40 pt-6 text-[#E9EDF1] md:px-8 md:pb-28 md:pt-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-5 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.25em] text-[#C7A96B]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Source-of-truth layer
            </div>
            <h1 className="text-2xl font-medium tracking-[-0.03em]">Evidence Ledger</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#77818C]">
              Every claim stays attached to a source, analytical role, reliability score, and the hypothesis or scenario it can move.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-px border border-white/[0.06] bg-white/[0.05] lg:min-w-[390px]">
            <HeaderMetric label="VERIFIED" value={verified} />
            <HeaderMetric label="CONTRADICTIONS" value={contradictions} />
            <HeaderMetric label="AVG RELIABILITY" value={`${averageReliability}%`} />
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`shrink-0 border px-3 py-2 font-mono text-[7px] uppercase tracking-[0.16em] transition ${
                  filter === item
                    ? 'border-[#43D9E6]/30 bg-[#43D9E6]/[0.05] text-[#BFEFF3]'
                    : 'border-white/[0.06] text-[#59636D] hover:text-[#AEB7C0]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="flex h-9 min-w-0 items-center border border-white/[0.07] bg-[#080C11] px-3 md:w-[300px]">
            <Search className="mr-2 h-3.5 w-3.5 text-[#59636D]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search claims, sources, cases…"
              className="min-w-0 flex-1 bg-transparent text-[11px] text-[#CBD2D9] outline-none placeholder:text-[#46505A]"
            />
            <Filter className="ml-2 h-3 w-3 text-[#46505A]" />
          </label>
        </div>

        <div className="hidden grid-cols-[1.65fr_.8fr_.55fr_.55fr_.7fr_1.2fr_36px] border border-white/[0.07] bg-[#080C11] md:grid">
          {['CLAIM / EVIDENCE', 'SOURCE', 'ROLE', 'REL', 'WEIGHT', 'LINKED THESIS', ''].map((label) => (
            <div key={label} className="border-r border-white/[0.05] px-3 py-2.5 font-mono text-[7px] uppercase tracking-[0.14em] text-[#4F5963] last:border-r-0">{label}</div>
          ))}
        </div>

        <div className="border-x border-b border-white/[0.07] bg-[#070A0E] md:border-t-0">
          {rows.map((item: any, index: number) => {
            const source: any = sourceById.get(item.sourceId);
            const hypothesis: any = hypothesisById.get(item.linkedHypothesisId);
            const scenario: any = scenarioById.get(item.linkedScenarioBranchId);
            const roleColor = item.evidenceType === 'contradicting'
              ? '#D66565'
              : item.evidenceType === 'supporting'
                ? '#43D9E6'
                : item.evidenceType === 'pending'
                  ? '#C7A96B'
                  : '#77818C';

            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index * 0.025, 0.3) }}
                onClick={() => openEvidence(item)}
                className="group block w-full border-b border-white/[0.045] text-left transition last:border-b-0 hover:bg-white/[0.018]"
              >
                <div className="hidden grid-cols-[1.65fr_.8fr_.55fr_.55fr_.7fr_1.2fr_36px] items-center md:grid">
                  <Cell>
                    <div className="line-clamp-1 text-[11px] text-[#D4DBE1]">{item.title}</div>
                    <div className="mt-1 line-clamp-1 text-[9px] text-[#59636D]">{item.summary}</div>
                  </Cell>
                  <Cell>
                    <div className="truncate text-[10px] text-[#9AA4AE]">{source?.sourceName || source?.title || 'Unknown'}</div>
                    <div className="mt-1 truncate font-mono text-[7px] uppercase tracking-[0.1em] text-[#4F5963]">{source?.sourceType || 'source'}</div>
                  </Cell>
                  <Cell><span className="font-mono text-[7px] uppercase tracking-[0.1em]" style={{ color: roleColor }}>{item.evidenceType || 'neutral'}</span></Cell>
                  <Cell><span className={(item.reliability || 0) >= 70 ? 'text-[#C7A96B]' : 'text-[#9AA4AE]'}>{Math.round(item.reliability || 0)}</span></Cell>
                  <Cell><span className="text-[#AEB7C0]">{Math.round(item.evidenceWeight || 0)}</span></Cell>
                  <Cell>
                    <div className="truncate text-[10px] text-[#89939D]">{scenario?.title || hypothesis?.title || 'Unlinked'}</div>
                    <div className="mt-1 flex items-center gap-1 font-mono text-[7px] text-[#4F5963]">
                      <Link2 className="h-2.5 w-2.5" />
                      {item.probabilityChange ? `${item.probabilityChange > 0 ? '+' : ''}${item.probabilityChange}p scenario` : `${item.confidenceChange || 0}p confidence`}
                    </div>
                  </Cell>
                  <div className="flex h-full items-center justify-center text-[#46505A] group-hover:text-[#43D9E6]"><ArrowUpRight className="h-3.5 w-3.5" /></div>
                </div>

                <div className="p-4 md:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.14em]">
                        <span style={{ color: roleColor }}>{item.evidenceType || 'neutral'}</span>
                        <span className="text-[#46505A]">REL {Math.round(item.reliability || 0)}</span>
                        <span className="text-[#46505A]">W {Math.round(item.evidenceWeight || 0)}</span>
                      </div>
                      <div className="text-[12px] leading-snug text-[#D4DBE1]">{item.title}</div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#46505A]" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4 border-t border-white/[0.05] pt-3">
                    <div className="truncate text-[9px] text-[#68727C]">{source?.sourceName || source?.title || 'Unknown source'}</div>
                    <div className="max-w-[50%] truncate text-right text-[9px] text-[#59636D]">{scenario?.title || hypothesis?.title || 'Unlinked'}</div>
                  </div>
                </div>
              </motion.button>
            );
          })}

          {!rows.length && (
            <div className="px-5 py-16 text-center">
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#59636D]">No matching evidence</div>
              <p className="mt-2 text-[11px] text-[#46505A]">Change the filter or synchronize the field to ingest new sources.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const HeaderMetric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-[#080C11] px-3 py-3">
    <div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#4F5963]">{label}</div>
    <div className="mt-1 text-sm font-light text-[#C9D0D7]">{value}</div>
  </div>
);

const Cell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-w-0 border-r border-white/[0.045] px-3 py-3.5 last:border-r-0">{children}</div>
);
