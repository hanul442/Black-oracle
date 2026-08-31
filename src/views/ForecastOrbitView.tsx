import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Crosshair, Orbit, Radar, Target } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppContext } from '../store';

type OrbitScenario = {
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
  x: number;
  y: number;
};

export const ForecastOrbitView: React.FC = () => {
  const { scenarios, hypotheses, evidence, setSelectedEntity, setCurrentView } = useAppContext() as any;
  const [activeId, setActiveId] = useState<string | null>(null);

  const orbitScenarios = useMemo<OrbitScenario[]>(() => {
    const items = (scenarios || []).slice(0, 9);
    return items.map((scenario: any, index: number) => {
      const probability = Math.max(0, Math.min(100, scenario.probability || 0));
      const impact = Math.max(0, Math.min(100, scenario.impactScore ?? 50));
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(items.length, 1);
      const radius = 126 + (100 - probability) * 1.55;
      return {
        id: scenario.id,
        title: scenario.title,
        probability,
        impact,
        hypothesisId: scenario.hypothesisId,
        trigger: scenario.triggerCondition || 'No explicit trigger recorded.',
        invalidation: scenario.invalidationCondition || 'No invalidation condition recorded.',
        outcome: scenario.expectedOutcome || 'Outcome not yet specified.',
        indicators: scenario.nextIndicators || [],
        timeFrame: scenario.timeFrame || scenario.timeline,
        x: 400 + Math.cos(angle) * radius,
        y: 310 + Math.sin(angle) * radius * 0.72,
      };
    });
  }, [scenarios]);

  const leading = [...orbitScenarios].sort((a, b) => b.probability - a.probability)[0];
  const active = orbitScenarios.find((item) => item.id === activeId) || leading || null;
  const probabilityTotal = orbitScenarios.reduce((sum, item) => sum + item.probability, 0);
  const weightedImpact = probabilityTotal
    ? Math.round(orbitScenarios.reduce((sum, item) => sum + item.probability * item.impact, 0) / probabilityTotal)
    : 0;

  const hypothesis = active
    ? (hypotheses || []).find((item: any) => item.id === active.hypothesisId)
    : null;
  const evidenceCount = active
    ? (evidence || []).filter((item: any) => item.linkedScenarioBranchId === active.id || item.linkedHypothesisId === active.hypothesisId).length
    : 0;

  const activate = (item: OrbitScenario) => {
    setActiveId(item.id);
    setSelectedEntity({ type: 'scenario', id: item.id });
  };

  return (
    <div className="relative h-full overflow-hidden bg-[#05070A] text-[#E9EDF1]">
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 45%, rgba(199,169,107,0.07), transparent 28%), linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: 'auto, 56px 56px, 56px 56px',
        }}
      />

      <div className="absolute left-4 top-4 z-20 md:left-8 md:top-7">
        <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.24em] text-[#C7A96B]">
          <Orbit className="h-3.5 w-3.5" />
          Scenario projection
        </div>
        <h1 className="text-lg font-medium tracking-[-0.03em] md:text-2xl">Forecast Orbit</h1>
        <p className="mt-1 hidden max-w-[390px] text-xs leading-relaxed text-[#77818C] sm:block">
          Probability controls distance from the current state. Impact controls mass. Select a branch to inspect what would move it.
        </p>
      </div>

      <div className="absolute right-5 top-5 z-20 hidden gap-6 font-mono text-[8px] uppercase tracking-[0.16em] text-[#59636D] md:flex">
        <span>{orbitScenarios.length} branches</span>
        <span>{probabilityTotal}% modeled mass</span>
        <span>{weightedImpact} weighted impact</span>
      </div>

      <div className="absolute inset-x-0 bottom-[242px] top-[70px] md:bottom-[210px] md:top-[74px]">
        <svg className="h-full w-full" viewBox="0 0 800 620" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="forecastGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="currentStateHalo">
              <stop offset="0%" stopColor="#43D9E6" stopOpacity="0.13" />
              <stop offset="100%" stopColor="#43D9E6" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx="400" cy="310" rx="128" ry="92" fill="url(#currentStateHalo)" />
          <ellipse cx="400" cy="310" rx="130" ry="94" fill="none" stroke="#43D9E6" strokeOpacity="0.07" />
          <ellipse cx="400" cy="310" rx="225" ry="162" fill="none" stroke="#FFFFFF" strokeOpacity="0.035" />
          <ellipse cx="400" cy="310" rx="315" ry="226" fill="none" stroke="#FFFFFF" strokeOpacity="0.025" />

          {orbitScenarios.map((item, index) => {
            const isActive = active?.id === item.id;
            const isLeading = leading?.id === item.id;
            const risk = item.impact >= 70 && item.probability < 35;
            const color = risk ? '#D66565' : isLeading ? '#C7A96B' : '#DDE3E8';
            const radius = 8 + item.impact * 0.09;

            return (
              <g key={item.id} onClick={() => activate(item)} className="cursor-pointer">
                <motion.line
                  x1="400"
                  y1="310"
                  x2={item.x}
                  y2={item.y}
                  stroke={isActive ? color : '#7B858F'}
                  strokeOpacity={isActive ? 0.32 : 0.065}
                  strokeDasharray={isActive ? '3 6' : '2 9'}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, delay: index * 0.04 }}
                />
                <motion.circle
                  cx={item.x}
                  cy={item.y}
                  r={radius * 2.7}
                  fill={color}
                  fillOpacity={isActive ? 0.08 : 0.018}
                  animate={{ scale: isActive ? [1, 1.1, 1] : [1, 1.035, 1] }}
                  transition={{ duration: isActive ? 3.8 : 7 + (index % 3), repeat: Infinity, ease: 'easeInOut' }}
                />
                <circle
                  cx={item.x}
                  cy={item.y}
                  r={radius}
                  fill="#05070A"
                  stroke={color}
                  strokeOpacity={isActive ? 0.95 : 0.5}
                  strokeWidth={isActive ? 1.5 : 0.8}
                  filter={isActive ? 'url(#forecastGlow)' : undefined}
                />
                <text
                  x={item.x}
                  y={item.y + 3}
                  textAnchor="middle"
                  fill={color}
                  fontSize="8"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {item.probability}
                </text>
                <text
                  x={item.x}
                  y={item.y + radius + 16}
                  textAnchor="middle"
                  fill={isActive ? '#E9EDF1' : '#7D8792'}
                  fontSize={isActive ? '8.5' : '7.2'}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {item.title.length > 24 ? `${item.title.slice(0, 24)}…` : item.title}
                </text>
              </g>
            );
          })}

          <motion.g
            style={{ transformOrigin: '400px 310px' }}
            animate={{ scale: [1, 1.035, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <circle cx="400" cy="310" r="36" fill="#05070A" stroke="#E9EDF1" strokeOpacity="0.3" />
            <circle cx="400" cy="310" r="4.5" fill="#43D9E6" filter="url(#forecastGlow)" />
            <text x="400" y="365" textAnchor="middle" fill="#77818C" fontSize="8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" letterSpacing="1.4">
              CURRENT STATE
            </text>
          </motion.g>
        </svg>
      </div>

      <AnimatePresence mode="wait">
        {active ? (
          <motion.section
            key={active.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-[132px] left-1/2 z-30 w-[calc(100%-24px)] max-w-[880px] -translate-x-1/2 border border-white/[0.08] bg-[#090D12]/97 p-4 shadow-2xl backdrop-blur-2xl lg:bottom-16 md:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[7px] uppercase tracking-[0.16em] text-[#59636D]">
                  <span className="text-[#C7A96B]">SCENARIO</span>
                  <span>•</span>
                  <span>{active.timeFrame || 'timeframe open'}</span>
                  <span>•</span>
                  <span>{evidenceCount} linked evidence</span>
                </div>
                <h2 className="line-clamp-1 text-base font-medium text-[#E0E5EA]">{active.title}</h2>
                {hypothesis && <p className="mt-1 line-clamp-1 text-[10px] text-[#66717B]">Thesis: {hypothesis.title}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-light text-[#E9EDF1]">{active.probability}%</div>
                  <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#59636D]">probability</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-light text-[#AEB7C0]">{active.impact}</div>
                  <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#59636D]">impact</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-px bg-white/[0.05] sm:grid-cols-3">
              <ScenarioFact icon={Crosshair} label="TRIGGER" value={active.trigger} />
              <ScenarioFact icon={AlertTriangle} label="INVALIDATION" value={active.invalidation} />
              <ScenarioFact icon={Target} label="EXPECTED OUTCOME" value={active.outcome} />
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2 text-[9px] text-[#59636D]">
                <Radar className="h-3.5 w-3.5 shrink-0 text-[#43D9E6]" />
                <span className="truncate">Watch next: {active.indicators.length ? active.indicators.slice(0, 3).join(' · ') : 'No next indicators recorded.'}</span>
              </div>
              <button
                onClick={() => setCurrentView('watchlist')}
                className="flex shrink-0 items-center justify-center gap-2 border border-white/[0.09] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.15em] text-[#AEB7C0] transition hover:border-[#43D9E6]/30 hover:text-[#E9EDF1]"
              >
                Deep analysis <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.section>
        ) : (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center">
            <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#59636D]">No scenarios modeled</div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ScenarioFact = ({ icon: Icon, label, value }: any) => (
  <div className="bg-[#070A0E] p-3.5">
    <div className="flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.14em] text-[#59636D]">
      <Icon className="h-3 w-3" />
      {label}
    </div>
    <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#A4ADB6]">{value}</p>
  </div>
);
