import React, { useMemo } from 'react';
import { ArrowUpRight, CircleDot, FileSearch, GitMerge, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';

export const CasesView: React.FC = () => {
  const {
    questions,
    hypotheses,
    signals,
    scenarios,
    evidence,
    setSelectedEntity,
    setCurrentView,
  } = useAppContext() as any;

  const cases = useMemo(() => {
    const questionItems = (questions || []).map((question: any) => {
      const linkedHypotheses = (hypotheses || []).filter((hypothesis: any) =>
        question.hypothesisIds?.includes(hypothesis.id) || hypothesis.questionId === question.id,
      );
      const hypothesisIds = new Set(linkedHypotheses.map((item: any) => item.id));
      const linkedSignals = (signals || []).filter((signal: any) =>
        question.signalIds?.includes(signal.id) || signal.linkedQuestionIds?.includes(question.id),
      );
      const linkedScenarios = (scenarios || []).filter((scenario: any) =>
        hypothesisIds.has(scenario.hypothesisId) || linkedHypotheses.some((item: any) => item.scenarioIds?.includes(scenario.id)),
      );
      const linkedEvidence = (evidence || []).filter((item: any) =>
        hypothesisIds.has(item.linkedHypothesisId) || linkedHypotheses.some((hypothesis: any) => hypothesis.evidenceIds?.includes(item.id)),
      );

      const averageConfidence = linkedHypotheses.length
        ? linkedHypotheses.reduce((sum: number, item: any) => sum + (item.confidence || 0), 0) / linkedHypotheses.length
        : 0;
      const evidenceQuality = linkedEvidence.length
        ? linkedEvidence.reduce((sum: number, item: any) => sum + (item.reliability || 0), 0) / linkedEvidence.length
        : 0;
      const leadingScenario = [...linkedScenarios].sort((a: any, b: any) => (b.probability || 0) - (a.probability || 0))[0];
      const contradictions = linkedEvidence.filter((item: any) => item.evidenceType === 'contradicting').length;

      return {
        id: question.id,
        title: question.text,
        hypothesis: linkedHypotheses[0],
        signalCount: linkedSignals.length,
        hypothesisCount: linkedHypotheses.length,
        scenarioCount: linkedScenarios.length,
        evidenceCount: linkedEvidence.length,
        contradictions,
        confidence: Math.round(averageConfidence),
        evidenceQuality: Math.round(evidenceQuality),
        leadingScenario,
      };
    });

    if (questionItems.length) return questionItems;

    return (hypotheses || []).map((hypothesis: any) => ({
      id: hypothesis.id,
      title: hypothesis.title,
      hypothesis,
      signalCount: 0,
      hypothesisCount: 1,
      scenarioCount: (scenarios || []).filter((scenario: any) => scenario.hypothesisId === hypothesis.id).length,
      evidenceCount: (evidence || []).filter((item: any) => item.linkedHypothesisId === hypothesis.id).length,
      contradictions: (evidence || []).filter((item: any) => item.linkedHypothesisId === hypothesis.id && item.evidenceType === 'contradicting').length,
      confidence: Math.round(hypothesis.confidence || 0),
      evidenceQuality: 0,
      leadingScenario: (scenarios || []).find((scenario: any) => scenario.hypothesisId === hypothesis.id),
    }));
  }, [questions, hypotheses, signals, scenarios, evidence]);

  const openCase = (item: any) => {
    if (item.hypothesis?.id) setSelectedEntity({ type: 'hypothesis', id: item.hypothesis.id });
    setCurrentView('watchlist');
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-40 pt-6 text-[#E9EDF1] md:px-8 md:pb-28 md:pt-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-4 border-b border-white/[0.06] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 font-mono text-[8px] uppercase tracking-[0.25em] text-[#43D9E6]">Analytical workspace</div>
            <h1 className="text-2xl font-medium tracking-[-0.03em]">Cases</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#77818C]">
              Questions become cases. Each case preserves the chain from signal to hypothesis, evidence, scenario, and decision.
            </p>
          </div>
          <div className="flex items-center gap-5 font-mono text-[8px] uppercase tracking-[0.18em] text-[#59636D]">
            <span>{cases.length} active cases</span>
            <span>{evidence?.length || 0} evidence items</span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {cases.map((item: any, index: number) => {
            const state = item.contradictions > 0 ? 'CONTESTED' : item.evidenceCount > 0 ? 'DEVELOPING' : 'UNRESOLVED';
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: Math.min(index * 0.04, 0.28) }}
                onClick={() => openCase(item)}
                className="group text-left border border-white/[0.07] bg-[#090D12]/72 p-4 transition hover:border-[#43D9E6]/22 hover:bg-[#0B1016] md:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.18em] text-[#59636D]">
                      <CircleDot className="h-3 w-3 text-[#43D9E6]" />
                      CASE {String(index + 1).padStart(3, '0')}
                      <span className={state === 'CONTESTED' ? 'text-[#D66565]' : 'text-[#87919B]'}>{state}</span>
                    </div>
                    <h2 className="line-clamp-2 text-base font-medium leading-snug text-[#DDE3E8]">{item.title}</h2>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#4D5862] transition group-hover:text-[#43D9E6]" />
                </div>

                <div className="mt-5 grid grid-cols-4 border-y border-white/[0.05] py-3">
                  <Metric label="SIGNALS" value={item.signalCount} />
                  <Metric label="HYPOTHESES" value={item.hypothesisCount} />
                  <Metric label="EVIDENCE" value={item.evidenceCount} />
                  <Metric label="SCENARIOS" value={item.scenarioCount} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-[#C7A96B]" />
                    <div>
                      <div className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#59636D]">Case confidence</div>
                      <div className="mt-1 text-sm text-[#CBD2D9]">{item.confidence || 0}%</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileSearch className="mt-0.5 h-3.5 w-3.5 text-[#43D9E6]" />
                    <div>
                      <div className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#59636D]">Evidence quality</div>
                      <div className="mt-1 text-sm text-[#CBD2D9]">{item.evidenceQuality || '—'}{item.evidenceQuality ? '%' : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <GitMerge className="mt-0.5 h-3.5 w-3.5 text-[#77818C]" />
                    <div className="min-w-0">
                      <div className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#59636D]">Leading scenario</div>
                      <div className="mt-1 truncate text-[11px] text-[#AEB7C0]">
                        {item.leadingScenario ? `${item.leadingScenario.probability || 0}% · ${item.leadingScenario.title}` : 'Not formed'}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {!cases.length && (
          <div className="border border-dashed border-white/[0.08] px-5 py-16 text-center">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#59636D]">No analytical cases yet</div>
            <p className="mt-2 text-xs text-[#4F5963]">Ask Oracle a question or synchronize new signals to create the first case.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="border-r border-white/[0.05] px-2 first:pl-0 last:border-r-0">
    <div className="font-mono text-[7px] uppercase tracking-[0.14em] text-[#4F5963]">{label}</div>
    <div className="mt-1 text-lg font-light text-[#D8DEE4]">{value}</div>
  </div>
);
