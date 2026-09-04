import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, CircleDot, Filter, GitBranch, Radio, Search } from 'lucide-react';
import { useAppContext } from '../store';

type NexusNode = {
  id: string;
  type: 'signal' | 'hypothesis' | 'scenario' | 'evidence';
  title: string;
  score: number;
  meta: string;
};

type NexusLink = {
  from: string;
  to: string;
  weight: number;
};

const labels: Record<NexusNode['type'], string> = {
  signal: 'Signal',
  hypothesis: 'Hypothesis',
  scenario: 'Scenario',
  evidence: 'Evidence',
};

export const MobileNexusView: React.FC = () => {
  const {
    signals,
    hypotheses,
    scenarios,
    evidence,
    setSelectedEntity,
    setCurrentView,
  } = useAppContext() as any;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<NexusNode['type'] | 'all'>('all');
  const [query, setQuery] = useState('');

  const { nodes, links } = useMemo(() => {
    const items: NexusNode[] = [];
    const relations: NexusLink[] = [];

    const push = (source: any[], type: NexusNode['type']) => {
      (source || []).slice(0, 12).forEach((item: any) => {
        const score = Number(item.signalStrength ?? item.confidence ?? item.probability ?? item.reliability ?? 50);
        const meta = type === 'signal'
          ? item.category || 'live signal'
          : type === 'scenario'
            ? `${Math.round(item.probability || 0)}% probability`
            : type === 'evidence'
              ? `${Math.round(item.reliability || 0)}% reliability`
              : item.status || 'active thesis';
        items.push({
          id: item.id,
          type,
          title: item.title || item.text || item.statement || labels[type],
          score: Math.max(0, Math.min(100, score)),
          meta,
        });
      });
    };

    push(signals, 'signal');
    push(hypotheses, 'hypothesis');
    push(scenarios, 'scenario');
    push(evidence, 'evidence');

    const ids = new Set(items.map((item) => item.id));

    (hypotheses || []).slice(0, 12).forEach((hypothesis: any) => {
      const related = (signals || []).filter((signal: any) => signal.linkedQuestionIds?.includes(hypothesis.questionId));
      (related.length ? related : (signals || []).slice(0, 1)).forEach((signal: any) => {
        if (ids.has(signal.id) && ids.has(hypothesis.id)) relations.push({ from: signal.id, to: hypothesis.id, weight: hypothesis.confidence || 50 });
      });
    });

    (scenarios || []).slice(0, 12).forEach((scenario: any) => {
      if (ids.has(scenario.hypothesisId) && ids.has(scenario.id)) relations.push({ from: scenario.hypothesisId, to: scenario.id, weight: scenario.probability || 50 });
    });

    (evidence || []).slice(0, 12).forEach((item: any) => {
      const target = item.linkedScenarioBranchId || item.linkedHypothesisId;
      if (target && ids.has(target) && ids.has(item.id)) relations.push({ from: item.id, to: target, weight: item.evidenceWeight || item.reliability || 50 });
    });

    return { nodes: items, links: relations };
  }, [signals, hypotheses, scenarios, evidence]);

  const ranked = useMemo(() => [...nodes].sort((a, b) => b.score - a.score), [nodes]);
  const active = nodes.find((node) => node.id === activeId) || ranked[0] || null;

  const neighborhood = useMemo(() => {
    if (!active) return [];
    const ids = new Set<string>([active.id]);
    links.forEach((link) => {
      if (link.from === active.id) ids.add(link.to);
      if (link.to === active.id) ids.add(link.from);
    });
    return nodes.filter((node) => ids.has(node.id));
  }, [active, links, nodes]);

  const visible = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return ranked.filter((node) => {
      const typeMatch = filter === 'all' || node.type === filter;
      const queryMatch = !lower || node.title.toLowerCase().includes(lower) || node.meta.toLowerCase().includes(lower);
      return typeMatch && queryMatch;
    });
  }, [ranked, filter, query]);

  const select = (node: NexusNode) => {
    setActiveId(node.id);
    setSelectedEntity({ type: node.type, id: node.id });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-32 pt-4 text-[#E9EDF1] lg:hidden">
      <header className="border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.2em] text-[#70CAD2]">
          <Radio className="h-3 w-3" /> Mobile nexus
        </div>
        <h1 className="mt-2 text-[24px] font-medium tracking-[-0.035em]">Raw Field</h1>
        <p className="mt-1 text-[10px] leading-relaxed text-[#68737D]">Inspect one local relationship neighborhood at a time. The full graph remains available on desktop.</p>
      </header>

      <div className="mt-3 flex items-center border border-white/[0.07] bg-[#080C11] px-3">
        <Search className="h-3.5 w-3.5 text-[#4E5963]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find signal, thesis, scenario, evidence…"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[11px] text-[#DCE2E6] outline-none placeholder:text-[#46515B]"
        />
      </div>

      <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
        {(['all', 'signal', 'hypothesis', 'scenario', 'evidence'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`shrink-0 border px-2.5 py-2 font-mono text-[6px] uppercase tracking-[0.13em] ${
              filter === item ? 'border-[#43D9E6]/25 bg-[#43D9E6]/[0.035] text-[#78CBD2]' : 'border-white/[0.06] text-[#56616C]'
            }`}
          >
            {item === 'all' ? 'All' : labels[item]}
          </button>
        ))}
      </div>

      {active && (
        <section className="mt-4 border border-white/[0.07] bg-[#080C11]">
          <div className="flex items-center justify-between border-b border-white/[0.055] px-3 py-2.5">
            <div>
              <div className="font-mono text-[6px] uppercase tracking-[0.17em] text-[#4E5963]">Selected neighborhood</div>
              <div className="mt-1 text-[11px] text-[#C7CFD5]">{labels[active.type]}</div>
            </div>
            <span className="font-mono text-[9px] tabular-nums text-[#8D98A2]">{Math.round(active.score)}</span>
          </div>

          <div className="p-3">
            <div className="border-l border-[#43D9E6]/25 pl-3">
              <div className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#70CAD2]">Focused node</div>
              <h2 className="mt-1 text-[13px] font-medium leading-snug text-[#E1E6EA]">{active.title}</h2>
              <div className="mt-1 font-mono text-[6px] uppercase tracking-[0.12em] text-[#4E5963]">{active.meta}</div>
            </div>

            <div className="mt-3 space-y-1.5">
              {neighborhood.filter((node) => node.id !== active.id).map((node) => {
                const relation = links.find((link) =>
                  (link.from === active.id && link.to === node.id) ||
                  (link.to === active.id && link.from === node.id),
                );
                return (
                  <button key={node.id} onClick={() => select(node)} className="flex w-full items-center gap-2 border border-white/[0.055] bg-[#05080C] px-3 py-2.5 text-left">
                    <CircleDot className="h-3 w-3 shrink-0 text-[#59636D]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] text-[#AEB7BF]">{node.title}</span>
                      <span className="mt-0.5 block font-mono text-[6px] uppercase tracking-[0.11em] text-[#46515B]">{labels[node.type]} · weight {Math.round(relation?.weight || node.score)}</span>
                    </span>
                    <ArrowRight className="h-3 w-3 text-[#3F4952]" />
                  </button>
                );
              })}
              {neighborhood.length <= 1 && <div className="border border-dashed border-white/[0.06] px-3 py-4 text-center text-[9px] text-[#4E5963]">No direct relationship recorded for this node.</div>}
            </div>

            <button
              onClick={() => setCurrentView(active.type === 'scenario' ? 'forecast' : 'watchlist')}
              className="mt-3 flex w-full items-center justify-between border border-white/[0.08] px-3 py-2.5 font-mono text-[7px] uppercase tracking-[0.14em] text-[#8D98A2]"
            >
              Open decision workspace <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      )}

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.17em] text-[#4E5963]"><Filter className="h-3 w-3" /> Intelligence index</div>
          <div className="font-mono text-[6px] text-[#46515B]">{visible.length} visible</div>
        </div>
        <div className="space-y-1">
          {visible.map((node) => {
            const selected = active?.id === node.id;
            return (
              <button
                key={node.id}
                onClick={() => select(node)}
                className={`flex w-full items-center gap-3 border px-3 py-3 text-left ${selected ? 'border-[#43D9E6]/25 bg-[#43D9E6]/[0.025]' : 'border-white/[0.055] bg-[#070A0E]'}`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${node.type === 'signal' ? 'bg-[#43D9E6]' : node.type === 'scenario' && node.score < 35 ? 'bg-[#D66565]' : node.type === 'evidence' && node.score >= 80 ? 'bg-[#C7A96B]' : 'bg-[#7B858E]'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] text-[#B6BFC7]">{node.title}</span>
                  <span className="mt-1 block font-mono text-[6px] uppercase tracking-[0.11em] text-[#46515B]">{labels[node.type]} · {node.meta}</span>
                </span>
                <span className="font-mono text-[8px] tabular-nums text-[#68737D]">{Math.round(node.score)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-4 flex items-start gap-2 border-t border-white/[0.05] pt-3 text-[9px] leading-relaxed text-[#4E5963]">
        <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Mobile intentionally shows local relationships rather than a compressed full-field graph.
      </div>
    </div>
  );
};
