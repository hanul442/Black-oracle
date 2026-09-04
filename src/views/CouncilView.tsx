import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  ChevronRight,
  CircleDot,
  GitCompareArrows,
  Layers3,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppContext } from '../store';

type CouncilLens = {
  id: string;
  label: string;
  scope: string;
  conviction: number;
  state: string;
  thesis: string;
  evidenceCount: number;
  contradictionCount: number;
  signalCount: number;
  hypothesisId?: string;
  accent: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value || 0)));
const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const CouncilView: React.FC = () => {
  const { signals, hypotheses, scenarios, evidence, setSelectedEntity, setCurrentView } = useAppContext() as any;
  const [activeLensId, setActiveLensId] = useState<string | null>(null);

  const model = useMemo(() => {
    const signalItems = signals || [];
    const hypothesisItems = hypotheses || [];
    const scenarioItems = scenarios || [];
    const evidenceItems = evidence || [];

    const byTerms = (terms: string[]) =>
      signalItems.filter((item: any) => {
        const haystack = `${item.category || ''} ${item.title || ''} ${item.summary || ''}`.toLowerCase();
        return terms.some((term) => haystack.includes(term));
      });

    const topHypothesis = [...hypothesisItems].sort(
      (a: any, b: any) => Number(b.confidence || 0) - Number(a.confidence || 0),
    )[0];
    const weakHypothesis = [...hypothesisItems].sort(
      (a: any, b: any) => Number(a.confidence || 0) - Number(b.confidence || 0),
    )[0];
    const baseScenario = [...scenarioItems].sort(
      (a: any, b: any) => Number(b.probability || 0) - Number(a.probability || 0),
    )[0];
    const riskScenario = [...scenarioItems].sort(
      (a: any, b: any) =>
        Number(b.probability || 0) * Number(b.impactScore || 50) -
        Number(a.probability || 0) * Number(a.impactScore || 50),
    )[0];

    const contradicting = evidenceItems.filter((item: any) => item.evidenceType === 'contradicting');
    const reliable = evidenceItems.filter((item: any) => Number(item.reliability || 0) >= 70);
    const macroSignals = byTerms(['macro', 'rate', 'inflation', 'currency', 'policy', 'bank', 'bond']);
    const marketSignals = byTerms(['market', 'stock', 'equity', 'flow', 'valuation', 'price']);
    const techSignals = byTerms(['ai', 'tech', 'semiconductor', 'chip', 'infrastructure']);

    const signalScore = (items: any[]) =>
      clamp(average((items.length ? items : signalItems).map((item: any) => Number(item.signalStrength || 0))));
    const evidenceScore = clamp(average(evidenceItems.map((item: any) => Number(item.reliability || 0))));
    const scenarioScore = clamp(average(scenarioItems.map((item: any) => Number(item.probability || 0))));

    const lenses: CouncilLens[] = [
      {
        id: 'macro',
        label: 'MACRO',
        scope: 'Rates · liquidity · FX · policy',
        conviction: clamp(signalScore(macroSignals) * 0.55 + evidenceScore * 0.45),
        state: signalScore(macroSignals) >= 65 ? 'PRESSURE BUILDING' : 'MIXED',
        thesis: topHypothesis?.title || 'No macro-linked hypothesis has formed yet.',
        evidenceCount: reliable.length,
        contradictionCount: contradicting.length,
        signalCount: macroSignals.length,
        hypothesisId: topHypothesis?.id,
        accent: '#43D9E6',
      },
      {
        id: 'market',
        label: 'MARKET',
        scope: 'Price · flow · positioning · valuation',
        conviction: clamp(signalScore(marketSignals) * 0.6 + scenarioScore * 0.4),
        state: signalScore(marketSignals) >= 70 ? 'MOMENTUM ACTIVE' : 'NEUTRAL',
        thesis: baseScenario?.title || topHypothesis?.title || 'No market branch has formed yet.',
        evidenceCount: evidenceItems.length,
        contradictionCount: contradicting.length,
        signalCount: marketSignals.length,
        hypothesisId: baseScenario?.hypothesisId || topHypothesis?.id,
        accent: '#BFC7CE',
      },
      {
        id: 'technology',
        label: 'TECHNOLOGY',
        scope: 'AI · semiconductors · infrastructure',
        conviction: clamp(signalScore(techSignals) * 0.65 + evidenceScore * 0.35),
        state: signalScore(techSignals) >= 65 ? 'STRUCTURAL SIGNAL' : 'INSUFFICIENT',
        thesis: topHypothesis?.title || 'Technology evidence remains below thesis threshold.',
        evidenceCount: techSignals.reduce((sum: number, item: any) => sum + (item.sourceIds?.length || 0), 0),
        contradictionCount: contradicting.length,
        signalCount: techSignals.length,
        hypothesisId: topHypothesis?.id,
        accent: '#C7A96B',
      },
      {
        id: 'risk',
        label: 'RISK',
        scope: 'Tail risk · fragility · invalidation',
        conviction: clamp(
          Number(riskScenario?.probability || 0) * 0.45 +
            Number(riskScenario?.impactScore || 50) * 0.35 +
            contradicting.length * 5,
        ),
        state: contradicting.length > 0 ? 'BASE CASE CHALLENGED' : 'TAILS MONITORED',
        thesis: riskScenario?.title || weakHypothesis?.title || 'No explicit risk branch has formed yet.',
        evidenceCount: evidenceItems.length,
        contradictionCount: contradicting.length,
        signalCount: signalItems.length,
        hypothesisId: riskScenario?.hypothesisId || weakHypothesis?.id,
        accent: '#D66565',
      },
      {
        id: 'contrarian',
        label: 'CONTRARIAN',
        scope: 'Counter-evidence · crowded assumptions',
        conviction: clamp((100 - Number(weakHypothesis?.confidence || 50)) * 0.45 + contradicting.length * 8 + 25),
        state: contradicting.length >= 2 ? 'DISSENT ACTIVE' : 'LOW CONVICTION',
        thesis: weakHypothesis?.title || 'No competing hypothesis is available to challenge.',
        evidenceCount: contradicting.length,
        contradictionCount: contradicting.length,
        signalCount: 0,
        hypothesisId: weakHypothesis?.id,
        accent: '#929CA6',
      },
    ];

    const consensus = clamp(average(lenses.map((lens) => lens.conviction)));
    const maxConviction = lenses.length ? Math.max(...lenses.map((lens) => lens.conviction)) : 0;
    const minConviction = lenses.length ? Math.min(...lenses.map((lens) => lens.conviction)) : 0;
    const disagreement = clamp(maxConviction - minConviction);
    const dissent = lenses.filter((lens) => lens.id === 'risk' || lens.id === 'contrarian').filter((lens) => lens.conviction >= 55).length;
    const disposition =
      disagreement >= 30 || contradicting.length >= 3
        ? 'REVIEW'
        : consensus >= 68 && contradicting.length <= 1
          ? 'ADVANCE'
          : 'MONITOR';

    return {
      lenses,
      consensus,
      disagreement,
      dissent,
      disposition,
      contradicting,
      topHypothesis,
      weakHypothesis,
      baseScenario,
      riskScenario,
    };
  }, [signals, hypotheses, scenarios, evidence]);

  const selected = model.lenses.find((lens) => lens.id === activeLensId) || model.lenses[0];

  const selectLens = (lens: CouncilLens) => {
    setActiveLensId(lens.id);
    if (lens.hypothesisId) setSelectedEntity({ type: 'hypothesis', id: lens.hypothesisId });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-40 pt-6 text-[#E9EDF1] md:px-8 md:pb-28 md:pt-8">
      <div className="mx-auto max-w-[1380px]">
        <header className="mb-5 flex flex-col gap-5 border-b border-white/[0.06] pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.24em] text-[#43D9E6]">
              <BrainCircuit className="h-3.5 w-3.5" />
              Decision synthesis
            </div>
            <h1 className="text-2xl font-medium tracking-[-0.04em] md:text-3xl">Council</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#77818C]">
              One ledger, multiple analytical lenses. Council measures how much the evidence agrees, where the base case is being challenged, and whether the decision should advance or remain under review.
            </p>
          </div>

          <div className="flex items-center gap-3 border border-white/[0.07] bg-[#080C11] px-4 py-3">
            <span className={`h-2 w-2 rounded-full ${model.disposition === 'ADVANCE' ? 'bg-[#6AA891]' : model.disposition === 'REVIEW' ? 'bg-[#D66565]' : 'bg-[#C7A96B]'}`} />
            <div>
              <div className="font-mono text-[6px] uppercase tracking-[0.16em] text-[#59636D]">COUNCIL DISPOSITION</div>
              <div className="mt-1 text-sm font-medium tracking-[0.05em] text-[#D6DCE2]">{model.disposition}</div>
            </div>
          </div>
        </header>

        <section className="mb-4 grid gap-px border border-white/[0.07] bg-white/[0.045] md:grid-cols-4">
          <SummaryMetric label="CONSENSUS" value={`${model.consensus}`} suffix="/100" icon={Scale} />
          <SummaryMetric label="DISAGREEMENT" value={String(model.disagreement)} suffix="pts" icon={GitCompareArrows} alert={model.disagreement >= 30} />
          <SummaryMetric label="ACTIVE DISSENT" value={String(model.dissent)} suffix="lenses" icon={AlertTriangle} alert={model.dissent > 0} />
          <SummaryMetric label="CONTRADICTIONS" value={String(model.contradicting.length)} suffix="items" icon={ShieldAlert} alert={model.contradicting.length > 0} />
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_360px]">
          <section className="border border-white/[0.07] bg-[#080C11]">
            <PanelHeader eyebrow="Analytical lenses" title="Conviction map" detail={`${model.lenses.length} lenses`} />
            <div>
              {model.lenses.map((lens, index) => {
                const active = selected?.id === lens.id;
                return (
                  <button
                    key={lens.id}
                    onClick={() => selectLens(lens)}
                    className={`w-full border-b border-white/[0.05] px-4 py-4 text-left transition last:border-b-0 ${active ? 'bg-white/[0.035]' : 'hover:bg-white/[0.018]'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-white/[0.08] bg-[#05070A] font-mono text-[7px]" style={{ color: lens.accent }}>
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[8px] tracking-[0.16em]" style={{ color: active ? lens.accent : '#9AA4AE' }}>{lens.label}</span>
                          <span className="text-sm font-light tabular-nums text-[#CBD2D9]">{lens.conviction}</span>
                        </div>
                        <div className="mt-1 truncate text-[9px] text-[#59636D]">{lens.scope}</div>
                        <div className="mt-2 h-px bg-white/[0.045]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${lens.conviction}%` }}
                            transition={{ duration: 0.55, delay: Math.min(index * 0.05, 0.2) }}
                            className="h-px"
                            style={{ backgroundColor: lens.accent }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[6px] uppercase tracking-[0.12em]">
                          <span style={{ color: lens.accent }}>{lens.state}</span>
                          <span className="text-[#4A545E]">{lens.signalCount} signals · {lens.evidenceCount} evidence</span>
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[#414A53]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border border-white/[0.07] bg-[#080C11]">
            <PanelHeader eyebrow="Synthesis" title="What the council is resolving" detail={model.disposition} />
            <div className="p-4 md:p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <SynthesisCard
                  label="BASE THESIS"
                  icon={CircleDot}
                  title={model.topHypothesis?.title || 'No dominant thesis formed'}
                  meta={model.baseScenario ? `${model.baseScenario.probability || 0}% leading scenario` : 'Scenario unresolved'}
                  tone="#C7A96B"
                />
                <SynthesisCard
                  label="PRIMARY CHALLENGE"
                  icon={ShieldAlert}
                  title={model.riskScenario?.title || model.weakHypothesis?.title || 'No explicit challenge formed'}
                  meta={`${model.contradicting.length} contradicting evidence items`}
                  tone="#D66565"
                />
              </div>

              <div className="mt-4 border border-white/[0.055] bg-[#06090D] p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-[7px] uppercase tracking-[0.17em] text-[#59636D]">Council spread</div>
                    <div className="mt-1 text-sm text-[#BFC7CE]">Agreement is useful only when dissent remains visible.</div>
                  </div>
                  <BarChart3 className="h-4 w-4 text-[#59636D]" />
                </div>
                <div className="space-y-3">
                  {model.lenses.map((lens) => (
                    <div key={lens.id} className="grid grid-cols-[80px_1fr_32px] items-center gap-3">
                      <span className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#59636D]">{lens.label}</span>
                      <div className="relative h-1 bg-white/[0.04]">
                        <div className="absolute left-1/2 top-[-2px] h-[5px] w-px bg-white/[0.08]" />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${lens.conviction}%` }}
                          className="h-1"
                          style={{ backgroundColor: lens.accent }}
                        />
                      </div>
                      <span className="text-right font-mono text-[7px] text-[#87919B]">{lens.conviction}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-px bg-white/[0.045] sm:grid-cols-3">
                <DecisionRule label="ADVANCE" active={model.disposition === 'ADVANCE'} text="High agreement, low contradiction" />
                <DecisionRule label="MONITOR" active={model.disposition === 'MONITOR'} text="Evidence still forming" />
                <DecisionRule label="REVIEW" active={model.disposition === 'REVIEW'} text="Disagreement or contradiction elevated" />
              </div>
            </div>
          </section>

          <aside className="border border-white/[0.07] bg-[#080C11] xl:sticky xl:top-0 xl:self-start">
            <PanelHeader eyebrow="Selected lens" title={selected?.label || 'Lens'} detail={selected ? `${selected.conviction}` : '—'} />
            <AnimatePresence mode="wait">
              {selected && (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="p-4"
                >
                  <div className="border-b border-white/[0.06] pb-4">
                    <div className="font-mono text-[7px] uppercase tracking-[0.16em]" style={{ color: selected.accent }}>{selected.state}</div>
                    <p className="mt-2 text-sm leading-relaxed text-[#D2D8DE]">{selected.thesis}</p>
                    <p className="mt-2 text-[9px] text-[#59636D]">{selected.scope}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-px bg-white/[0.045] py-px">
                    <SmallMetric label="CONVICTION" value={`${selected.conviction}`} />
                    <SmallMetric label="EVIDENCE" value={`${selected.evidenceCount}`} />
                    <SmallMetric label="COUNTER" value={`${selected.contradictionCount}`} danger={selected.contradictionCount > 0} />
                  </div>

                  <div className="mt-4 border border-white/[0.055] bg-[#06090D] p-3">
                    <div className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.14em] text-[#59636D]">
                      <Layers3 className="h-3 w-3" />
                      Interpretation
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-[#8E98A1]">
                      This lens does not create a separate answer. It reweights the same signals, evidence, and scenarios to expose where the current decision is sensitive.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (selected.hypothesisId) setSelectedEntity({ type: 'hypothesis', id: selected.hypothesisId });
                      setCurrentView('watchlist');
                    }}
                    className="mt-4 flex w-full items-center justify-between border border-white/[0.09] px-3 py-2.5 font-mono text-[8px] uppercase tracking-[0.15em] text-[#9FA8B1] transition hover:border-[#43D9E6]/30 hover:text-[#E9EDF1]"
                  >
                    Inspect underlying thesis <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </div>
    </div>
  );
};

const SummaryMetric = ({ label, value, suffix, icon: Icon, alert }: any) => (
  <div className="bg-[#080C11] p-4 md:p-5">
    <div className="flex items-center justify-between">
      <span className="font-mono text-[6px] uppercase tracking-[0.16em] text-[#59636D]">{label}</span>
      <Icon className={`h-3.5 w-3.5 ${alert ? 'text-[#D66565]' : 'text-[#59636D]'}`} />
    </div>
    <div className="mt-2 flex items-end gap-1.5">
      <span className={`text-2xl font-light tabular-nums ${alert ? 'text-[#D66565]' : 'text-[#D4DAE0]'}`}>{value}</span>
      <span className="mb-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-[#4F5963]">{suffix}</span>
    </div>
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

const SynthesisCard = ({ label, icon: Icon, title, meta, tone }: any) => (
  <div className="border border-white/[0.055] bg-[#06090D] p-4">
    <div className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.15em]" style={{ color: tone }}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
    <div className="mt-3 text-sm leading-relaxed text-[#C8CFD5]">{title}</div>
    <div className="mt-2 text-[9px] text-[#59636D]">{meta}</div>
  </div>
);

const DecisionRule = ({ label, active, text }: any) => (
  <div className={`p-3 ${active ? 'bg-white/[0.055]' : 'bg-[#06090D]'}`}>
    <div className={`font-mono text-[7px] uppercase tracking-[0.15em] ${active ? 'text-[#C7A96B]' : 'text-[#4F5963]'}`}>{label}</div>
    <p className="mt-1.5 text-[9px] leading-relaxed text-[#68727C]">{text}</p>
  </div>
);

const SmallMetric = ({ label, value, danger }: any) => (
  <div className="bg-[#06090D] px-2 py-3 text-center">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</div>
    <div className={`mt-1 text-sm font-light tabular-nums ${danger ? 'text-[#D66565]' : 'text-[#C8CFD5]'}`}>{value}</div>
  </div>
);
