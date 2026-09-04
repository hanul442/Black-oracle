import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  CircleDot,
  FileSearch,
  GitBranch,
  Radar,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value || 0)));

export const WatchlistView: React.FC = () => {
  const {
    sources,
    signals,
    questions,
    hypotheses,
    scenarios,
    evidence,
    selectedEntity,
    setSelectedEntity,
    setCurrentView,
  } = useAppContext() as any;

  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const model = useMemo(() => {
    const sourceItems = sources || [];
    const signalItems = signals || [];
    const questionItems = questions || [];
    const hypothesisItems = hypotheses || [];
    const scenarioItems = scenarios || [];
    const evidenceItems = evidence || [];

    const selectedEvidence = selectedEntity?.type === 'evidence'
      ? evidenceItems.find((item: any) => item.id === selectedEntity.id)
      : null;
    const selectedScenario = selectedEntity?.type === 'scenario' || selectedEntity?.type === 'branch'
      ? scenarioItems.find((item: any) => item.id === selectedEntity.id)
      : null;
    const selectedQuestion = selectedEntity?.type === 'question'
      ? questionItems.find((item: any) => item.id === selectedEntity.id)
      : null;
    const selectedSignal = selectedEntity?.type === 'signal'
      ? signalItems.find((item: any) => item.id === selectedEntity.id)
      : null;
    const selectedSource = selectedEntity?.type === 'source'
      ? sourceItems.find((item: any) => item.id === selectedEntity.id)
      : null;

    let focusHypothesis = selectedEntity?.type === 'hypothesis'
      ? hypothesisItems.find((item: any) => item.id === selectedEntity.id)
      : null;

    if (!focusHypothesis && selectedEvidence?.linkedHypothesisId) {
      focusHypothesis = hypothesisItems.find((item: any) => item.id === selectedEvidence.linkedHypothesisId);
    }
    if (!focusHypothesis && selectedScenario?.hypothesisId) {
      focusHypothesis = hypothesisItems.find((item: any) => item.id === selectedScenario.hypothesisId);
    }
    if (!focusHypothesis && selectedQuestion) {
      focusHypothesis = hypothesisItems.find((item: any) => item.questionId === selectedQuestion.id || selectedQuestion.hypothesisIds?.includes(item.id));
    }
    if (!focusHypothesis && selectedSignal) {
      const question = questionItems.find((item: any) => item.signalIds?.includes(selectedSignal.id) || selectedSignal.linkedQuestionIds?.includes(item.id));
      if (question) focusHypothesis = hypothesisItems.find((item: any) => item.questionId === question.id || question.hypothesisIds?.includes(item.id));
    }
    if (!focusHypothesis && selectedSource) {
      const sourceEvidence = evidenceItems.find((item: any) => item.sourceId === selectedSource.id && item.linkedHypothesisId);
      if (sourceEvidence) focusHypothesis = hypothesisItems.find((item: any) => item.id === sourceEvidence.linkedHypothesisId);
      if (!focusHypothesis) {
        const signal = signalItems.find((item: any) => item.sourceIds?.includes(selectedSource.id));
        const question = signal ? questionItems.find((item: any) => item.signalIds?.includes(signal.id)) : null;
        if (question) focusHypothesis = hypothesisItems.find((item: any) => item.questionId === question.id || question.hypothesisIds?.includes(item.id));
      }
    }
    if (!focusHypothesis) {
      focusHypothesis = [...hypothesisItems].sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))[0] || null;
    }

    const question = focusHypothesis
      ? questionItems.find((item: any) => item.id === focusHypothesis.questionId || item.hypothesisIds?.includes(focusHypothesis.id))
      : null;
    const linkedScenarios = focusHypothesis
      ? scenarioItems.filter((item: any) => item.hypothesisId === focusHypothesis.id || focusHypothesis.scenarioIds?.includes(item.id))
      : [];
    const linkedEvidence = focusHypothesis
      ? evidenceItems.filter((item: any) => item.linkedHypothesisId === focusHypothesis.id || focusHypothesis.evidenceIds?.includes(item.id))
      : [];
    const linkedSignals = question
      ? signalItems.filter((item: any) => question.signalIds?.includes(item.id) || item.linkedQuestionIds?.includes(question.id))
      : [];
    const sourceIds = new Set([
      ...linkedEvidence.map((item: any) => item.sourceId),
      ...linkedSignals.flatMap((item: any) => item.sourceIds || []),
    ].filter(Boolean));
    const linkedSources = sourceItems.filter((item: any) => sourceIds.has(item.id));

    const supporting = linkedEvidence.filter((item: any) => item.evidenceType === 'supporting');
    const contradicting = linkedEvidence.filter((item: any) => item.evidenceType === 'contradicting');
    const neutral = linkedEvidence.filter((item: any) => item.evidenceType === 'neutral' || item.evidenceType === 'pending');
    const avgReliability = linkedEvidence.length
      ? linkedEvidence.reduce((sum: number, item: any) => sum + (item.reliability || 0), 0) / linkedEvidence.length
      : 0;
    const leadingScenario = [...linkedScenarios].sort((a: any, b: any) => (b.probability || 0) - (a.probability || 0))[0] || null;
    const conflictRate = linkedEvidence.length ? (contradicting.length / linkedEvidence.length) * 100 : 0;

    return {
      hypothesis: focusHypothesis,
      question,
      linkedScenarios,
      linkedEvidence,
      linkedSignals,
      linkedSources,
      supporting,
      contradicting,
      neutral,
      avgReliability: clamp(avgReliability),
      leadingScenario,
      conflictRate: clamp(conflictRate),
    };
  }, [sources, signals, questions, hypotheses, scenarios, evidence, selectedEntity]);

  const activeScenario = model.linkedScenarios.find((item: any) => item.id === activeScenarioId)
    || model.leadingScenario
    || null;

  if (!model.hypothesis) {
    return (
      <div className="flex h-full items-center justify-center bg-[#05070A] px-6 text-center text-[#E9EDF1]">
        <div>
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#59636D]">No case available</div>
          <button onClick={() => setCurrentView('cases')} className="mt-4 border border-white/[0.08] px-4 py-2 text-xs text-[#AEB7C0]">Return to cases</button>
        </div>
      </div>
    );
  }

  const confidence = clamp(model.hypothesis.confidence || 0);
  const disposition = confidence >= 72 && model.conflictRate <= 25
    ? 'ADVANCE'
    : confidence >= 55
      ? 'MONITOR'
      : 'REVIEW';
  const dispositionColor = disposition === 'ADVANCE' ? '#43D9E6' : disposition === 'MONITOR' ? '#C7A96B' : '#D66565';

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] text-[#E9EDF1] custom-scrollbar">
      <div className="mx-auto max-w-7xl px-4 pb-36 pt-5 md:px-8 md:pb-24 md:pt-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentView('cases')}
            className="flex h-9 items-center gap-2 border border-white/[0.07] px-3 font-mono text-[8px] uppercase tracking-[0.14em] text-[#77818C] transition hover:border-white/[0.14] hover:text-[#D7DDE3]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Cases
          </button>
          <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.16em] text-[#59636D]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#43D9E6]" />
            decision workspace
          </div>
        </div>

        <header className="border border-white/[0.07] bg-[#080C11]">
          <div className="grid gap-px bg-white/[0.05] lg:grid-cols-[1.7fr_.65fr_.65fr_.65fr]">
            <div className="bg-[#080C11] p-5 md:p-7">
              <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[7px] uppercase tracking-[0.17em] text-[#59636D]">
                <span className="text-[#43D9E6]">CASE DETAIL</span>
                <span>•</span>
                <span>{model.linkedSignals.length} signals</span>
                <span>•</span>
                <span>{model.linkedEvidence.length} evidence</span>
              </div>
              <h1 className="max-w-4xl text-xl font-medium leading-snug tracking-[-0.025em] text-[#E6EAEE] md:text-3xl">
                {model.question?.text || model.hypothesis.title}
              </h1>
              {model.question && (
                <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-[#77818C] md:text-xs">
                  Working thesis: <span className="text-[#B6BEC6]">{model.hypothesis.title}</span>
                </p>
              )}
            </div>
            <HeaderMetric label="CONFIDENCE" value={`${confidence}%`} />
            <HeaderMetric label="RELIABILITY" value={`${model.avgReliability}%`} />
            <div className="bg-[#080C11] p-4 md:p-5">
              <div className="font-mono text-[7px] uppercase tracking-[0.15em] text-[#59636D]">DISPOSITION</div>
              <div className="mt-2 font-mono text-sm tracking-[0.12em]" style={{ color: dispositionColor }}>{disposition}</div>
              <div className="mt-2 h-px bg-white/[0.06]"><div className="h-px" style={{ width: `${confidence}%`, backgroundColor: dispositionColor }} /></div>
            </div>
          </div>
        </header>

        <section className="mt-4 border border-white/[0.07] bg-[#080C11]">
          <SectionTitle icon={GitBranch} title="Decision chain" note="Signal → Question → Hypothesis → Scenario → Evidence" />
          <div className="grid gap-px bg-white/[0.05] sm:grid-cols-2 lg:grid-cols-5">
            <ChainCell label="SIGNAL" value={model.linkedSignals[0]?.title || 'No dominant signal'} meta={`${model.linkedSignals.length} linked`} accent="#43D9E6" />
            <ChainCell label="QUESTION" value={model.question?.text || 'Question unresolved'} meta="case frame" accent="#9AA4AE" />
            <ChainCell label="HYPOTHESIS" value={model.hypothesis.title} meta={`${confidence}% confidence`} accent="#C7A96B" />
            <ChainCell label="SCENARIO" value={model.leadingScenario?.title || 'No scenario formed'} meta={model.leadingScenario ? `${model.leadingScenario.probability || 0}% probability` : 'unmodeled'} accent="#E9EDF1" />
            <ChainCell label="EVIDENCE" value={`${model.supporting.length} support / ${model.contradicting.length} counter`} meta={`${model.avgReliability}% avg reliability`} accent={model.contradicting.length ? '#D66565' : '#43D9E6'} />
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <section className="border border-white/[0.07] bg-[#080C11]">
            <SectionTitle icon={Target} title="Scenario board" note={`${model.linkedScenarios.length} modeled branches`} />
            <div className="divide-y divide-white/[0.05]">
              {model.linkedScenarios
                .slice()
                .sort((a: any, b: any) => (b.probability || 0) - (a.probability || 0))
                .map((scenario: any) => {
                  const active = activeScenario?.id === scenario.id;
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => {
                        setActiveScenarioId(scenario.id);
                        setSelectedEntity({ type: 'scenario', id: scenario.id });
                      }}
                      className={`grid w-full gap-3 px-4 py-4 text-left transition md:grid-cols-[60px_1fr_72px] md:items-center ${active ? 'bg-white/[0.035]' : 'hover:bg-white/[0.018]'}`}
                    >
                      <div>
                        <div className="text-xl font-light text-[#E1E6EB]">{Math.round(scenario.probability || 0)}%</div>
                        <div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#4F5963]">probability</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-[#CBD2D9]">{scenario.title}</div>
                        <div className="mt-1 line-clamp-1 text-[9px] text-[#59636D]">{scenario.expectedOutcome || scenario.triggerCondition || 'No outcome statement recorded.'}</div>
                      </div>
                      <div className="text-left md:text-right">
                        <div className="text-sm text-[#AEB7C0]">{Math.round(scenario.impactScore || 0)}</div>
                        <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">impact</div>
                      </div>
                    </button>
                  );
                })}
              {!model.linkedScenarios.length && <EmptyState text="No scenario branches linked to this case." />}
            </div>
          </section>

          <section className="border border-white/[0.07] bg-[#080C11]">
            <SectionTitle icon={Radar} title="Decision conditions" note="What changes the call" />
            {activeScenario ? (
              <div className="grid gap-px bg-white/[0.05] sm:grid-cols-2 xl:grid-cols-1">
                <ConditionBlock icon={CheckCircle2} label="TRIGGER" value={activeScenario.triggerCondition || 'No explicit trigger recorded.'} tone="#43D9E6" />
                <ConditionBlock icon={AlertTriangle} label="INVALIDATION" value={activeScenario.invalidationCondition || 'No invalidation rule recorded.'} tone="#D66565" />
                <ConditionBlock icon={Target} label="EXPECTED OUTCOME" value={activeScenario.expectedOutcome || 'Outcome not yet specified.'} tone="#C7A96B" />
                <ConditionBlock icon={Radar} label="WATCH NEXT" value={(activeScenario.nextIndicators || []).slice(0, 4).join(' · ') || 'No next indicators recorded.'} tone="#9AA4AE" />
              </div>
            ) : <EmptyState text="Select or create a scenario to define decision conditions." />}
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
          <section className="border border-white/[0.07] bg-[#080C11]">
            <SectionTitle icon={FileSearch} title="Evidence balance" note={`${model.supporting.length} supporting · ${model.contradicting.length} contradicting · ${model.neutral.length} neutral`} />
            <div className="grid gap-px bg-white/[0.05] md:grid-cols-2">
              <EvidenceColumn title="SUPPORTING" items={model.supporting} tone="#43D9E6" sources={sources || []} onOpen={(item: any) => setSelectedEntity({ type: 'evidence', id: item.id })} />
              <EvidenceColumn title="CONTRADICTING" items={model.contradicting} tone="#D66565" sources={sources || []} onOpen={(item: any) => setSelectedEntity({ type: 'evidence', id: item.id })} />
            </div>
          </section>

          <section className="border border-white/[0.07] bg-[#080C11]">
            <SectionTitle icon={ShieldCheck} title="Case integrity" note="Auditability" />
            <div className="divide-y divide-white/[0.05]">
              <IntegrityRow label="Source provenance" value={model.linkedSources.length ? `${model.linkedSources.length} linked` : 'Missing'} ok={model.linkedSources.length > 0} />
              <IntegrityRow label="Counter-evidence" value={model.contradicting.length ? `${model.contradicting.length} present` : 'None'} ok={model.contradicting.length > 0} warn />
              <IntegrityRow label="Scenario invalidation" value={model.linkedScenarios.some((item: any) => item.invalidationCondition) ? 'Defined' : 'Missing'} ok={model.linkedScenarios.some((item: any) => item.invalidationCondition)} />
              <IntegrityRow label="Evidence reliability" value={`${model.avgReliability}%`} ok={model.avgReliability >= 60} />
            </div>
          </section>
        </div>

        <section className="mt-4 border border-white/[0.07] bg-[#080C11]">
          <SectionTitle icon={BookOpen} title="Source register" note="Original provenance retained" />
          <div className="grid gap-px bg-white/[0.05] md:grid-cols-2 lg:grid-cols-3">
            {model.linkedSources.slice(0, 9).map((source: any) => (
              <button
                key={source.id}
                onClick={() => setSelectedEntity({ type: 'source', id: source.id })}
                className="group min-w-0 bg-[#070A0E] p-4 text-left transition hover:bg-[#0A0F14]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] text-[#C7CED5]">{source.sourceName || source.title}</div>
                    <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-[#4F5963]">{source.sourceType || 'source'} · REL {Math.round(source.reliability || 0)}</div>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#46505A] group-hover:text-[#43D9E6]" />
                </div>
                <p className="mt-3 line-clamp-2 text-[9px] leading-relaxed text-[#66717B]">{source.summary || source.rawTextSnippet || 'No source summary.'}</p>
              </button>
            ))}
            {!model.linkedSources.length && <div className="bg-[#070A0E] md:col-span-2 lg:col-span-3"><EmptyState text="No source provenance linked yet." /></div>}
          </div>
        </section>
      </div>
    </div>
  );
};

const HeaderMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#080C11] p-4 md:p-5">
    <div className="font-mono text-[7px] uppercase tracking-[0.15em] text-[#59636D]">{label}</div>
    <div className="mt-2 text-2xl font-light tracking-[-0.03em] text-[#DCE2E8]">{value}</div>
  </div>
);

const SectionTitle = ({ icon: Icon, title, note }: any) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
    <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.17em] text-[#87919B]">
      <Icon className="h-3.5 w-3.5 text-[#43D9E6]" /> {title}
    </div>
    <div className="hidden font-mono text-[7px] uppercase tracking-[0.12em] text-[#46505A] sm:block">{note}</div>
  </div>
);

const ChainCell = ({ label, value, meta, accent }: any) => (
  <div className="min-w-0 bg-[#070A0E] p-4">
    <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.14em]" style={{ color: accent }}>
      <CircleDot className="h-3 w-3" /> {label}
    </div>
    <div className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-[#C4CBD2]">{value}</div>
    <div className="mt-2 font-mono text-[6px] uppercase tracking-[0.1em] text-[#4F5963]">{meta}</div>
  </div>
);

const ConditionBlock = ({ icon: Icon, label, value, tone }: any) => (
  <div className="bg-[#070A0E] p-4">
    <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.14em]" style={{ color: tone }}><Icon className="h-3.5 w-3.5" />{label}</div>
    <p className="mt-3 text-[10px] leading-relaxed text-[#9AA4AE]">{value}</p>
  </div>
);

const EvidenceColumn = ({ title, items, tone, sources, onOpen }: any) => (
  <div className="bg-[#070A0E]">
    <div className="border-b border-white/[0.05] px-4 py-2.5 font-mono text-[7px] uppercase tracking-[0.15em]" style={{ color: tone }}>{title}</div>
    <div className="divide-y divide-white/[0.045]">
      {items.slice(0, 6).map((item: any) => {
        const source = sources.find((candidate: any) => candidate.id === item.sourceId);
        return (
          <button key={item.id} onClick={() => onOpen(item)} className="group block w-full px-4 py-3 text-left hover:bg-white/[0.018]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="line-clamp-2 text-[10px] leading-relaxed text-[#B8C0C8]">{item.title}</div>
                <div className="mt-1 font-mono text-[6px] uppercase tracking-[0.1em] text-[#4F5963]">REL {Math.round(item.reliability || 0)} · W {Math.round(item.evidenceWeight || 0)} · {source?.sourceName || 'unknown source'}</div>
              </div>
              <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-[#46505A] group-hover:text-[#43D9E6]" />
            </div>
          </button>
        );
      })}
      {!items.length && <EmptyState text={`No ${title.toLowerCase()} evidence linked.`} compact />}
    </div>
  </div>
);

const IntegrityRow = ({ label, value, ok, warn = false }: any) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3">
    <div className="text-[10px] text-[#89939D]">{label}</div>
    <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.12em]" style={{ color: ok ? '#43D9E6' : warn ? '#C7A96B' : '#D66565' }}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />} {value}
    </div>
  </div>
);

const EmptyState = ({ text, compact = false }: { text: string; compact?: boolean }) => (
  <div className={`${compact ? 'px-4 py-6' : 'px-5 py-10'} text-center font-mono text-[7px] uppercase tracking-[0.14em] text-[#46505A]`}>{text}</div>
);
