import React, { useMemo, useState } from 'react';
import { ArrowUpRight, BrainCircuit, ChevronRight, Scale, ShieldAlert, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';

type CouncilSeat = {
  id: string;
  role: string;
  remit: string;
  confidence: number;
  stance: string;
  thesis: string;
  evidenceCount: number;
  contradictionCount: number;
  hypothesisId?: string;
  accent: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value || 0)));

export const CouncilView: React.FC = () => {
  const { signals, hypotheses, scenarios, evidence, setSelectedEntity, setCurrentView } = useAppContext() as any;
  const [activeSeat, setActiveSeat] = useState<string | null>(null);

  const { seats, consensus, disagreement } = useMemo(() => {
    const signalItems = signals || [];
    const hypothesisItems = hypotheses || [];
    const scenarioItems = scenarios || [];
    const evidenceItems = evidence || [];

    const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const byTerms = (terms: string[]) => signalItems.filter((item: any) => {
      const haystack = `${item.category || ''} ${item.title || ''} ${item.summary || ''}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });
    const topHypothesis = [...hypothesisItems].sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))[0];
    const lowHypothesis = [...hypothesisItems].sort((a: any, b: any) => (a.confidence || 0) - (b.confidence || 0))[0];
    const topScenario = [...scenarioItems].sort((a: any, b: any) => (b.probability || 0) - (a.probability || 0))[0];
    const riskScenario = [...scenarioItems].sort((a: any, b: any) => ((b.impactScore || 0) * (b.probability || 0)) - ((a.impactScore || 0) * (a.probability || 0)))[0];
    const contradicting = evidenceItems.filter((item: any) => item.evidenceType === 'contradicting');
    const reliable = evidenceItems.filter((item: any) => (item.reliability || 0) >= 70);

    const macroSignals = byTerms(['macro', 'rate', 'inflation', 'currency', 'policy', 'bank', 'bond']);
    const marketSignals = byTerms(['market', 'stock', 'equity', 'flow', 'valuation', 'price']);
    const techSignals = byTerms(['ai', 'tech', 'semiconductor', 'chip', 'infrastructure']);

    const signalScore = (items: any[]) => clamp(avg((items.length ? items : signalItems).map((item: any) => item.signalStrength || 0)));
    const scenarioScore = clamp(avg(scenarioItems.map((item: any) => item.probability || 0)));
    const evidenceScore = clamp(avg(evidenceItems.map((item: any) => item.reliability || 0)));

    const seatData: CouncilSeat[] = [
      {
        id: 'macro',
        role: 'Macro Analyst',
        remit: 'Rates · liquidity · FX · policy',
        confidence: clamp((signalScore(macroSignals) * 0.55) + (evidenceScore * 0.45)),
        stance: signalScore(macroSignals) >= 65 ? 'PRESSURE BUILDING' : 'MIXED',
        thesis: topHypothesis?.title || 'No macro-linked hypothesis has formed yet.',
        evidenceCount: reliable.length,
        contradictionCount: contradicting.length,
        hypothesisId: topHypothesis?.id,
        accent: '#43D9E6',
      },
      {
        id: 'market',
        role: 'Market Analyst',
        remit: 'Price · flow · positioning · valuation',
        confidence: clamp((signalScore(marketSignals) * 0.6) + (scenarioScore * 0.4)),
        stance: signalScore(marketSignals) >= 70 ? 'MOMENTUM ACTIVE' : 'NEUTRAL',
        thesis: topScenario?.title || topHypothesis?.title || 'No market scenario has formed yet.',
        evidenceCount: evidenceItems.length,
        contradictionCount: contradicting.length,
        hypothesisId: topScenario?.hypothesisId || topHypothesis?.id,
        accent: '#E9EDF1',
      },
      {
        id: 'technology',
        role: 'Technology Analyst',
        remit: 'AI · semiconductors · infrastructure',
        confidence: clamp((signalScore(techSignals) * 0.65) + (evidenceScore * 0.35)),
        stance: signalScore(techSignals) >= 65 ? 'STRUCTURAL SIGNAL' : 'INSUFFICIENT',
        thesis: topHypothesis?.title || 'Technology evidence is still below thesis threshold.',
        evidenceCount: techSignals.reduce((sum: number, item: any) => sum + (item.sourceIds?.length || 0), 0),
        contradictionCount: contradicting.length,
        hypothesisId: topHypothesis?.id,
        accent: '#C7A96B',
      },
      {
        id: 'risk',
        role: 'Risk Analyst',
        remit: 'Tail risk · invalidation · fragility',
        confidence: clamp(((riskScenario?.probability || 0) * 0.45) + ((riskScenario?.impactScore || 50) * 0.35) + (contradicting.length * 5)),
        stance: contradicting.length > 0 ? 'CHALLENGING BASE CASE' : 'WATCHING TAILS',
        thesis: riskScenario?.title || lowHypothesis?.title || 'No explicit tail-risk branch has formed yet.',
        evidenceCount: evidenceItems.length,
        contradictionCount: contradicting.length,
        hypothesisId: riskScenario?.hypothesisId || lowHypothesis?.id,
        accent: '#D66565',
      },
      {
        id: 'contrarian',
        role: 'Contrarian Analyst',
        remit: 'Counter-evidence · crowded assumptions',
        confidence: clamp((100 - (lowHypothesis?.confidence || 50)) * 0.45 + (contradicting.length * 8) + 25),
        stance: contradicting.length >= 2 ? 'DISSENT ACTIVE' : 'LOW CONVICTION',
        thesis: lowHypothesis?.title || 'No competing hypothesis is available to challenge.',
        evidenceCount: contradicting.length,
        contradictionCount: contradicting.length,
        hypothesisId: lowHypothesis?.id,
        accent: '#9AA4AE',
      },
    ];

    const consensusScore = clamp(avg(seatData.map((seat) => seat.confidence)));
    const spread = seatData.length ? Math.max(...seatData.map((seat) => seat.confidence)) - Math.min(...seatData.map((seat) => seat.confidence)) : 0;

    return { seats: seatData, consensus: consensusScore, disagreement: clamp(spread) };
  }, [signals, hypotheses, scenarios, evidence]);

  const selected = seats.find((seat) => seat.id === activeSeat) || seats[0];

  const openSeat = (seat: CouncilSeat) => {
    setActiveSeat(seat.id);
    if (seat.hypothesisId) setSelectedEntity({ type: 'hypothesis', id: seat.hypothesisId });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-40 pt-6 text-[#E9EDF1] md:px-8 md:pb-28 md:pt-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 border-b border-white/[0.06] pb-6">
          <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.25em] text-[#43D9E6]">
            <BrainCircuit className="h-3.5 w-3.5" />
            Multi-perspective synthesis
          </div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Analyst Council</h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#77818C]">
            Each seat reads the same ledger through a different analytical lens. Confidence is derived from the current signal, evidence, and scenario state—not a separate decorative score.
          </p>
        </div>

        <div className="mb-4 grid gap-px border border-white/[0.07] bg-white/[0.05] md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="bg-[#090D12] p-5 md:p-6">
            <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#59636D]">Council consensus</div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-light tracking-[-0.04em]">{consensus}</span>
              <span className="mb-1 text-sm text-[#77818C]">/ 100</span>
            </div>
            <div className="mt-4 h-px w-full bg-white/[0.06]">
              <motion.div initial={{ width: 0 }} animate={{ width: `${consensus}%` }} className="h-px bg-[#43D9E6]" />
            </div>
          </div>
          <SummaryMetric icon={Scale} label="DISAGREEMENT" value={`${disagreement} pts`} note="confidence spread" />
          <SummaryMetric icon={ShieldAlert} label="CONTRADICTIONS" value={String((evidence || []).filter((item: any) => item.evidenceType === 'contradicting').length)} note="ledger items" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.35fr]">
          <div className="border border-white/[0.07] bg-[#080C11]">
            <div className="border-b border-white/[0.06] px-4 py-3 font-mono text-[8px] uppercase tracking-[0.2em] text-[#59636D]">Council seats</div>
            {seats.map((seat, index) => {
              const active = selected?.id === seat.id;
              return (
                <button
                  key={seat.id}
                  onClick={() => openSeat(seat)}
                  className={`flex w-full items-center gap-3 border-b border-white/[0.05] px-4 py-4 text-left transition last:border-b-0 ${active ? 'bg-white/[0.035]' : 'hover:bg-white/[0.02]'}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#05070A] font-mono text-[8px]" style={{ color: seat.accent }}>
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-[#D7DDE3]">{seat.role}</div>
                    <div className="mt-1 truncate font-mono text-[7px] uppercase tracking-[0.13em] text-[#59636D]">{seat.remit}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-light text-[#CBD2D9]">{seat.confidence}%</div>
                    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4D5761]">conviction</div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[#46505A]" />
                </button>
              );
            })}
          </div>

          {selected && (
            <motion.section
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-white/[0.07] bg-[#090D12]/76 p-5 md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: selected.accent }}>{selected.stance}</div>
                  <h2 className="mt-2 text-xl font-medium">{selected.role}</h2>
                  <p className="mt-1 text-[11px] text-[#68727C]">{selected.remit}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-[#05070A]">
                  <span className="text-lg font-light" style={{ color: selected.accent }}>{selected.confidence}</span>
                </div>
              </div>

              <div className="mt-7 border-l border-white/[0.08] pl-4">
                <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#59636D]">Current thesis under review</div>
                <p className="mt-2 text-base leading-relaxed text-[#D7DDE3]">{selected.thesis}</p>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-px bg-white/[0.05] sm:grid-cols-3">
                <CouncilMetric label="CONVICTION" value={`${selected.confidence}%`} />
                <CouncilMetric label="EVIDENCE" value={String(selected.evidenceCount)} />
                <CouncilMetric label="COUNTER" value={String(selected.contradictionCount)} />
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[10px] leading-relaxed text-[#66717B]">
                  <Sparkles className="h-3.5 w-3.5 text-[#C7A96B]" />
                  Seat metrics update as the evidence ledger changes.
                </div>
                <button
                  onClick={() => {
                    if (selected.hypothesisId) setSelectedEntity({ type: 'hypothesis', id: selected.hypothesisId });
                    setCurrentView('watchlist');
                  }}
                  className="flex items-center justify-center gap-2 border border-white/[0.09] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[#AEB7C0] transition hover:border-[#43D9E6]/30 hover:text-[#E9EDF1]"
                >
                  Inspect thesis <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.section>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryMetric = ({ icon: Icon, label, value, note }: any) => (
  <div className="flex items-center gap-3 bg-[#090D12] p-5 md:p-6">
    <Icon className="h-4 w-4 text-[#77818C]" />
    <div>
      <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#59636D]">{label}</div>
      <div className="mt-1 text-lg font-light text-[#D8DEE4]">{value}</div>
      <div className="mt-0.5 text-[9px] text-[#4F5963]">{note}</div>
    </div>
  </div>
);

const CouncilMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#070A0E] px-4 py-4">
    <div className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#4F5963]">{label}</div>
    <div className="mt-1 text-xl font-light text-[#D8DEE4]">{value}</div>
  </div>
);
