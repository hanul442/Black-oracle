import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Crosshair,
  Eye,
  GitBranch,
  Radar,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppContext } from '../store';

type ForecastScenario = {
  id: string;
  title: string;
  probability: number;
  impact: number;
  hypothesisId: string;
  trigger: string;
  invalidation: string;
  outcome: string;
  indicators: string[];
  timeFrame?: string;
  supporting: number;
  contradicting: number;
  neutral: number;
  evidenceQuality: number;
  evidenceDelta: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export const ForecastOrbitView: React.FC = () => {
  const { scenarios, hypotheses, evidence, setSelectedEntity, setCurrentView } = useAppContext() as any;
  const [activeId, setActiveId] = useState<string | null>(null);

  const forecastScenarios = useMemo<ForecastScenario[]>(() => {
    return (scenarios || []).map((scenario: any) => {
      const linkedEvidence = (evidence || []).filter(
        (item: any) =>
          item.linkedScenarioBranchId === scenario.id ||
          item.linkedHypothesisId === scenario.hypothesisId,
      );
      const supporting = linkedEvidence.filter((item: any) => item.evidenceType === 'supporting').length;
      const contradicting = linkedEvidence.filter((item: any) => item.evidenceType === 'contradicting').length;
      const neutral = linkedEvidence.length - supporting - contradicting;
      const evidenceQuality = linkedEvidence.length
        ? Math.round(
            linkedEvidence.reduce((sum: number, item: any) => sum + Number(item.reliability || 0), 0) /
              linkedEvidence.length,
          )
        : 0;
      const evidenceDelta = Math.round(
        linkedEvidence.reduce((sum: number, item: any) => sum + Number(item.probabilityChange || 0), 0) * 10,
      ) / 10;

      return {
        id: scenario.id,
        title: scenario.title,
        probability: clamp(Number(scenario.probability || 0)),
        impact: clamp(Number(scenario.impactScore ?? 50)),
        hypothesisId: scenario.hypothesisId,
        trigger: scenario.triggerCondition || 'No explicit trigger recorded.',
        invalidation: scenario.invalidationCondition || 'No invalidation condition recorded.',
        outcome: scenario.expectedOutcome || 'Outcome not yet specified.',
        indicators: scenario.nextIndicators || [],
        timeFrame: scenario.timeFrame || scenario.timeline,
        supporting,
        contradicting,
        neutral,
        evidenceQuality,
        evidenceDelta,
      };
    });
  }, [scenarios, evidence]);

  const sorted = useMemo(
    () => [...forecastScenarios].sort((a, b) => b.probability - a.probability),
    [forecastScenarios],
  );
  const leading = sorted[0] || null;
  const active = forecastScenarios.find((item) => item.id === activeId) || leading;
  const probabilityMass = Math.round(forecastScenarios.reduce((sum, item) => sum + item.probability, 0));
  const weightedImpact = probabilityMass
    ? Math.round(
        forecastScenarios.reduce((sum, item) => sum + item.probability * item.impact, 0) /
          probabilityMass,
      )
    : 0;
  const tailRisks = forecastScenarios.filter((item) => item.impact >= 70 && item.probability <= 35).length;
  const contested = forecastScenarios.filter((item) => item.contradicting > 0).length;
  const activeHypothesis = active
    ? (hypotheses || []).find((item: any) => item.id === active.hypothesisId)
    : null;

  const activate = (item: ForecastScenario) => {
    setActiveId(item.id);
    setSelectedEntity({ type: 'scenario', id: item.id });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-40 pt-5 text-[#E9EDF1] md:px-6 md:pb-28 md:pt-6 xl:px-8">
      <div className="mx-auto max-w-[1420px]">
        <header className="mb-4 flex flex-col gap-5 border-b border-white/[0.06] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.22em] text-[#B89E69]">
              <GitBranch className="h-3.5 w-3.5" />
              Forecast operating view
            </div>
            <h1 className="text-2xl font-medium tracking-[-0.04em] md:text-[28px]">Scenario Forecasts</h1>
            <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-[#6F7A84] md:text-xs">
              Read the transmission path first, then compare probability, impact, and evidence pressure. Every branch remains conditional.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px border border-white/[0.06] bg-white/[0.04] sm:grid-cols-4">
            <HeaderMetric label="BRANCHES" value={forecastScenarios.length} />
            <HeaderMetric label="MODELED MASS" value={`${probabilityMass}%`} />
            <HeaderMetric label="WEIGHTED IMPACT" value={weightedImpact} />
            <HeaderMetric label="TAIL RISKS" value={tailRisks} alert={tailRisks > 0} />
          </div>
        </header>

        <ScenarioFlow
          active={active}
          hypothesis={activeHypothesis}
          branches={sorted.filter((item) => !active || item.hypothesisId === active.hypothesisId).slice(0, 4)}
          onSelect={activate}
        />

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_360px]">
          <section className="border border-white/[0.07] bg-[#080C11]">
            <SectionHeader eyebrow="Probability stack" title="Branch distribution" detail={`${contested} contested`} />
            <div className="p-3 md:p-4">
              {sorted.length ? (
                <div className="space-y-2">
                  {sorted.map((item, index) => {
                    const isActive = active?.id === item.id;
                    const classification = getClassification(item, leading?.id === item.id);
                    return (
                      <motion.button
                        key={item.id}
                        onClick={() => activate(item)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: Math.min(index * 0.035, 0.2) }}
                        className={`w-full border p-3 text-left transition md:p-4 ${
                          isActive
                            ? 'border-[#C7A96B]/35 bg-[#C7A96B]/[0.045]'
                            : 'border-white/[0.05] bg-[#05080C] hover:border-white/[0.11]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-[7px] uppercase tracking-[0.15em]">
                              <span className={classification.className}>{classification.label}</span>
                              <span className="text-[#424B54]">·</span>
                              <span className="text-[#59636D]">{item.timeFrame || 'open horizon'}</span>
                              {item.contradicting > 0 && (
                                <>
                                  <span className="text-[#424B54]">·</span>
                                  <span className="text-[#D66565]">contested</span>
                                </>
                              )}
                            </div>
                            <h2 className="line-clamp-2 text-[13px] font-medium leading-snug text-[#D7DDE3] md:text-sm">{item.title}</h2>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xl font-light tabular-nums text-[#E8ECEF] md:text-2xl">{item.probability}%</div>
                            <div className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#4E5862]">probability</div>
                          </div>
                        </div>

                        <div className="mt-3 h-1 overflow-hidden bg-white/[0.045]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.probability}%` }}
                            transition={{ duration: 0.7, delay: Math.min(index * 0.04, 0.25) }}
                            className={`h-full ${isActive ? 'bg-[#C7A96B]' : 'bg-[#59636D]'}`}
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-4 border-t border-white/[0.045] pt-3">
                          <MiniMetric label="IMPACT" value={item.impact} />
                          <MiniMetric label="SUPPORT" value={item.supporting} positive />
                          <MiniMetric label="CONTRADICT" value={item.contradicting} negative={item.contradicting > 0} />
                          <MiniMetric
                            label="EVIDENCE Δ"
                            value={`${item.evidenceDelta > 0 ? '+' : ''}${item.evidenceDelta}`}
                            positive={item.evidenceDelta > 0}
                            negative={item.evidenceDelta < 0}
                          />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState />
              )}
            </div>
          </section>

          <section className="border border-white/[0.07] bg-[#080C11]">
            <SectionHeader eyebrow="Risk surface" title="Probability × impact" detail="select a node" />
            <div className="relative min-h-[430px] p-4 md:min-h-[520px]">
              <RiskMatrix scenarios={forecastScenarios} active={active} leading={leading} onSelect={activate} />
            </div>
          </section>

          <aside className="border border-white/[0.07] bg-[#080C11] xl:sticky xl:top-0 xl:self-start">
            <SectionHeader eyebrow="Scenario inspector" title="Decision conditions" detail={active ? `${active.probability}%` : '—'} />
            <AnimatePresence mode="wait">
              {active ? (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="p-4"
                >
                  <div className="border-b border-white/[0.06] pb-4">
                    <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#C7A96B]">ACTIVE BRANCH</div>
                    <h2 className="mt-2 text-base font-medium leading-snug text-[#E0E5EA]">{active.title}</h2>
                    {activeHypothesis && <p className="mt-2 text-[10px] leading-relaxed text-[#66717B]">Thesis: {activeHypothesis.title}</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-px border-b border-white/[0.06] bg-white/[0.04] py-px">
                    <InspectorMetric label="PROBABILITY" value={`${active.probability}%`} />
                    <InspectorMetric label="IMPACT" value={active.impact} />
                    <InspectorMetric label="QUALITY" value={active.evidenceQuality ? `${active.evidenceQuality}%` : '—'} />
                  </div>

                  <div className="space-y-3 py-4">
                    <Condition icon={Crosshair} label="Trigger" value={active.trigger} />
                    <Condition icon={ShieldAlert} label="Invalidation" value={active.invalidation} danger />
                    <Condition icon={Target} label="Expected outcome" value={active.outcome} />
                  </div>

                  <div className="border-t border-white/[0.06] pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-mono text-[7px] uppercase tracking-[0.17em] text-[#59636D]">Evidence balance</div>
                      <div className={`font-mono text-[8px] ${active.evidenceDelta >= 0 ? 'text-[#7AB9A5]' : 'text-[#D66565]'}`}>
                        {active.evidenceDelta > 0 ? '+' : ''}{active.evidenceDelta}
                      </div>
                    </div>
                    <EvidenceBalance item={active} />
                  </div>

                  <div className="mt-4 border-t border-white/[0.06] pt-4">
                    <div className="mb-2 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.16em] text-[#59636D]">
                      <Radar className="h-3 w-3 text-[#43D9E6]" />
                      Watch next
                    </div>
                    <div className="space-y-1.5">
                      {(active.indicators || []).slice(0, 4).map((indicator: string, index: number) => (
                        <div key={`${indicator}-${index}`} className="flex items-start gap-2 text-[10px] leading-relaxed text-[#89939D]">
                          <Eye className="mt-0.5 h-3 w-3 shrink-0 text-[#4F5963]" />
                          <span>{indicator}</span>
                        </div>
                      ))}
                      {!active.indicators.length && <span className="text-[10px] text-[#4F5963]">No next indicators recorded.</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentView('watchlist')}
                    className="mt-5 flex w-full items-center justify-between border border-white/[0.09] px-3 py-2.5 font-mono text-[8px] uppercase tracking-[0.16em] text-[#9FA8B1] transition hover:border-[#43D9E6]/30 hover:text-[#E9EDF1]"
                  >
                    Open case analysis <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ) : (
                <EmptyState compact />
              )}
            </AnimatePresence>
          </aside>
        </div>
      </div>
    </div>
  );
};

const ScenarioFlow = ({ active, hypothesis, branches, onSelect }: any) => (
  <section className="border border-white/[0.07] bg-[#070B10]">
    <div className="flex items-end justify-between gap-4 border-b border-white/[0.06] px-4 py-3">
      <div>
        <div className="font-mono text-[6px] uppercase tracking-[0.2em] text-[#4F5963]">Conditional transmission</div>
        <div className="mt-1 text-sm font-medium text-[#CBD2D9]">Scenario Flow</div>
      </div>
      <div className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#46515B]">selected neighborhood</div>
    </div>

    {active ? (
      <div className="overflow-x-auto p-3 md:p-4">
        <div className="grid min-w-[860px] grid-cols-[170px_34px_190px_34px_270px_34px_190px] items-center gap-2">
          <FlowNode label="Trigger" value={active.trigger} tone="cyan" />
          <FlowArrow />
          <FlowNode label="Thesis" value={hypothesis?.title || 'Linked thesis unavailable.'} />
          <FlowArrow />

          <div className="space-y-1.5">
            {(branches?.length ? branches : [active]).map((branch: ForecastScenario) => {
              const selected = branch.id === active.id;
              const tail = branch.impact >= 70 && branch.probability <= 35;
              return (
                <button
                  key={branch.id}
                  onClick={() => onSelect(branch)}
                  className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left transition ${
                    selected
                      ? tail
                        ? 'border-[#D66565]/40 bg-[#D66565]/[0.05]'
                        : 'border-[#43D9E6]/30 bg-[#43D9E6]/[0.045]'
                      : 'border-white/[0.055] bg-[#05080C] hover:border-white/[0.12]'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tail ? 'bg-[#D66565]' : selected ? 'bg-[#43D9E6]' : 'bg-[#59636D]'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] text-[#B9C2CA]">{branch.title}</span>
                    <span className="mt-1 block font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{branch.probability}% · impact {branch.impact}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <FlowArrow />
          <FlowNode label="Expected outcome" value={active.outcome} tone={active.impact >= 70 ? 'risk' : 'gold'} />
        </div>
      </div>
    ) : (
      <div className="p-8 text-center font-mono text-[7px] uppercase tracking-[0.16em] text-[#4F5963]">No active transmission path</div>
    )}
  </section>
);

const FlowNode = ({ label, value, tone }: any) => {
  const toneClass = tone === 'cyan'
    ? 'border-[#43D9E6]/24 bg-[#43D9E6]/[0.035]'
    : tone === 'risk'
      ? 'border-[#D66565]/25 bg-[#D66565]/[0.035]'
      : tone === 'gold'
        ? 'border-[#C7A96B]/24 bg-[#C7A96B]/[0.035]'
        : 'border-white/[0.06] bg-[#05080C]';
  return (
    <div className={`min-h-[88px] border p-3 ${toneClass}`}>
      <div className="font-mono text-[6px] uppercase tracking-[0.16em] text-[#4F5963]">{label}</div>
      <div className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-[#AEB7BF]">{value}</div>
    </div>
  );
};

const FlowArrow = () => (
  <div className="flex items-center justify-center text-[#3F4952]">
    <span className="h-px w-4 bg-white/[0.08]" />
    <ArrowRight className="-ml-0.5 h-3 w-3" />
  </div>
);

const RiskMatrix = ({ scenarios, active, leading, onSelect }: any) => (
  <div className="absolute inset-4">
    <div className="absolute inset-0 border-l border-b border-white/[0.08]">
      {[25, 50, 75].map((value) => (
        <React.Fragment key={value}>
          <div className="absolute left-0 right-0 border-t border-dashed border-white/[0.04]" style={{ bottom: `${value}%` }} />
          <div className="absolute bottom-0 top-0 border-l border-dashed border-white/[0.04]" style={{ left: `${value}%` }} />
        </React.Fragment>
      ))}
    </div>

    <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[7px] uppercase tracking-[0.17em] text-[#4F5963]">Impact →</div>
    <div className="pointer-events-none absolute left-0 top-1/2 -translate-x-[42%] -translate-y-1/2 -rotate-90 font-mono text-[7px] uppercase tracking-[0.17em] text-[#4F5963]">Probability →</div>

    <div className="pointer-events-none absolute left-[64%] top-[8%] font-mono text-[6px] uppercase tracking-[0.15em] text-[#D66565]/55">HIGH-CONVICTION RISK</div>
    <div className="pointer-events-none absolute left-[64%] bottom-[10%] font-mono text-[6px] uppercase tracking-[0.15em] text-[#C7A96B]/50">TAIL RISK</div>
    <div className="pointer-events-none absolute left-[10%] top-[8%] font-mono text-[6px] uppercase tracking-[0.15em] text-[#6D7781]">BASE / LOW IMPACT</div>

    {scenarios.map((item: ForecastScenario, index: number) => {
      const isActive = active?.id === item.id;
      const isLeading = leading?.id === item.id;
      const tail = item.impact >= 70 && item.probability <= 35;
      const left = clamp(item.impact, 4, 96);
      const bottom = clamp(item.probability, 5, 94);
      const size = 32 + item.probability * 0.16;
      const tone = tail ? '#D66565' : isLeading ? '#C7A96B' : '#9AA4AE';
      return (
        <motion.button
          key={item.id}
          onClick={() => onSelect(item)}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
          className="absolute -translate-x-1/2 translate-y-1/2"
          style={{ left: `${left}%`, bottom: `${bottom}%` }}
          aria-label={item.title}
        >
          <span
            className="relative flex items-center justify-center rounded-full border bg-[#05070A] font-mono text-[8px] transition"
            style={{
              width: size,
              height: size,
              borderColor: `${tone}${isActive ? 'D0' : '66'}`,
              color: isActive ? '#F0F2F4' : tone,
              boxShadow: isActive ? `0 0 26px ${tone}20` : undefined,
            }}
          >
            {item.probability}
            {item.contradicting > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-[#05070A] bg-[#D66565]" />}
          </span>
          {isActive && (
            <span className="absolute left-1/2 top-[calc(100%+7px)] w-28 -translate-x-1/2 text-center font-mono text-[6px] leading-relaxed text-[#8D97A1]">
              {item.title.length > 34 ? `${item.title.slice(0, 34)}…` : item.title}
            </span>
          )}
        </motion.button>
      );
    })}
  </div>
);

const EvidenceBalance = ({ item }: { item: ForecastScenario }) => {
  const total = item.supporting + item.contradicting + item.neutral;
  if (!total) return <div className="h-1.5 bg-white/[0.045]" />;
  const supportWidth = (item.supporting / total) * 100;
  const contradictWidth = (item.contradicting / total) * 100;
  const neutralWidth = 100 - supportWidth - contradictWidth;
  return (
    <>
      <div className="flex h-1.5 overflow-hidden bg-white/[0.04]">
        <div className="bg-[#4B9B83]" style={{ width: `${supportWidth}%` }} />
        <div className="bg-[#59636D]" style={{ width: `${neutralWidth}%` }} />
        <div className="bg-[#B95E5E]" style={{ width: `${contradictWidth}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-3 font-mono text-[6px] uppercase tracking-[0.13em]">
        <span className="text-[#6FAF9B]">{item.supporting} support</span>
        <span className="text-center text-[#59636D]">{item.neutral} neutral</span>
        <span className="text-right text-[#C36A6A]">{item.contradicting} contradict</span>
      </div>
    </>
  );
};

const getClassification = (item: ForecastScenario, leading: boolean) => {
  if (leading) return { label: 'BASE CASE', className: 'text-[#C7A96B]' };
  if (item.impact >= 70 && item.probability <= 35) return { label: 'TAIL RISK', className: 'text-[#D66565]' };
  if (item.probability >= 30) return { label: 'CHALLENGER', className: 'text-[#8DAAB0]' };
  return { label: 'MONITOR', className: 'text-[#59636D]' };
};

const HeaderMetric = ({ label, value, alert }: any) => (
  <div className="min-w-[118px] bg-[#070A0E] px-3 py-3">
    <div className="font-mono text-[6px] uppercase tracking-[0.16em] text-[#4F5963]">{label}</div>
    <div className={`mt-1 text-base font-light tabular-nums ${alert ? 'text-[#D66565]' : 'text-[#C9D0D6]'}`}>{value}</div>
  </div>
);

const SectionHeader = ({ eyebrow, title, detail }: any) => (
  <div className="flex items-end justify-between gap-4 border-b border-white/[0.06] px-4 py-3.5">
    <div>
      <div className="font-mono text-[6px] uppercase tracking-[0.18em] text-[#59636D]">{eyebrow}</div>
      <div className="mt-1 text-sm font-medium text-[#CBD2D9]">{title}</div>
    </div>
    <div className="font-mono text-[7px] uppercase tracking-[0.14em] text-[#4F5963]">{detail}</div>
  </div>
);

const MiniMetric = ({ label, value, positive, negative }: any) => (
  <div className="border-r border-white/[0.045] px-2 first:pl-0 last:border-r-0">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4A545E]">{label}</div>
    <div className={`mt-1 text-[11px] tabular-nums ${positive ? 'text-[#77AE9D]' : negative ? 'text-[#C86C6C]' : 'text-[#8F99A3]'}`}>{value}</div>
  </div>
);

const InspectorMetric = ({ label, value }: any) => (
  <div className="bg-[#070A0E] py-3 text-center">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</div>
    <div className="mt-1 text-sm font-light tabular-nums text-[#C8CFD5]">{value}</div>
  </div>
);

const Condition = ({ icon: Icon, label, value, danger }: any) => (
  <div className="border border-white/[0.055] bg-[#06090D] p-3">
    <div className={`flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.15em] ${danger ? 'text-[#B66A6A]' : 'text-[#5C6670]'}`}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
    <p className="mt-2 text-[10px] leading-relaxed text-[#969FA8]">{value}</p>
  </div>
);

const EmptyState = ({ compact = false }: { compact?: boolean }) => (
  <div className={`${compact ? 'p-10' : 'py-20'} text-center`}>
    <AlertTriangle className="mx-auto h-4 w-4 text-[#59636D]" />
    <div className="mt-3 font-mono text-[8px] uppercase tracking-[0.18em] text-[#59636D]">No scenarios modeled</div>
    <p className="mx-auto mt-2 max-w-xs text-[10px] leading-relaxed text-[#48525C]">Forecast branches will appear after a hypothesis develops enough evidence to model alternative outcomes.</p>
  </div>
);
