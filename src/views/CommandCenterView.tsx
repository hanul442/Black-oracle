import React from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  CircleAlert,
  Database,
  GitBranch,
  Radar,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAppContext } from '../store';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const Panel: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <section className={`border border-white/[0.07] bg-[#080C11]/88 ${className}`}>{children}</section>
);

const Kicker: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="font-mono text-[7px] uppercase tracking-[0.2em] text-[#5D6873]">{children}</div>
);

export const CommandCenterView: React.FC = () => {
  const {
    sources,
    signals,
    hypotheses,
    evidence,
    predictions,
    reports,
    setCurrentView,
    activeFeeds,
  } = useAppContext() as any;

  const rankedSignals = [...(signals || [])]
    .sort((a: any, b: any) => ((b.signalStrength || 0) + (b.urgency || 0)) - ((a.signalStrength || 0) + (a.urgency || 0)))
    .slice(0, 4);

  const rankedHypotheses = [...(hypotheses || [])]
    .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 3);

  const rankedPredictions = [...(predictions || [])]
    .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 3);

  const supporting = (evidence || []).filter((item: any) => item.evidenceType === 'supporting').length;
  const contradicting = (evidence || []).filter((item: any) => item.evidenceType === 'contradicting').length;
  const evidenceTotal = Math.max(1, (evidence || []).length);
  const supportShare = Math.round((supporting / evidenceTotal) * 100);
  const contradictionShare = Math.round((contradicting / evidenceTotal) * 100);
  const avgConfidence = rankedHypotheses.length
    ? Math.round(rankedHypotheses.reduce((sum: number, item: any) => sum + Number(item.confidence || 0), 0) / rankedHypotheses.length)
    : 0;

  const topPrediction = rankedPredictions[0];
  const topSignal = rankedSignals[0];
  const healthScore = clamp(72 + Math.min(14, (activeFeeds || []).length * 2) - Math.min(18, contradictionShare / 2));
  const scrutiny = contradictionShare > 25;
  const situationJudgment = topPrediction?.statement
    || topSignal?.summary
    || topSignal?.title
    || 'No active signal currently requires escalation.';

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] pb-28 lg:pb-12">
      <div className="mx-auto w-full max-w-[1560px] px-4 py-5 md:px-6 md:py-6 xl:px-8">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="mb-4 flex flex-col justify-between gap-4 border-b border-white/[0.06] pb-4 md:flex-row md:items-end"
        >
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.22em] text-[#70CAD2]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#43D9E6]" />
              Situation room
            </div>
            <h1 className="text-[27px] font-medium tracking-[-0.04em] text-[#F0F3F5] sm:text-[34px]">Command</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#6B7680] sm:text-xs">
              Start with the judgment. Drill into the evidence only where the state has changed.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentView('oracle-field')} className="border border-white/[0.07] bg-white/[0.015] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.15em] text-[#7D8892] hover:text-[#D7DEE3]">
              Raw field
            </button>
            <button onClick={() => setCurrentView('forecast')} className="border border-[#43D9E6]/18 bg-[#43D9E6]/[0.035] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.15em] text-[#79C7CE] hover:border-[#43D9E6]/30">
              Forecasts
            </button>
          </div>
        </motion.div>

        <Panel className="mb-4 overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
            <div className="border-b border-white/[0.06] p-4 md:p-5 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`border px-2 py-1 font-mono text-[6px] uppercase tracking-[0.16em] ${scrutiny ? 'border-[#D66565]/25 bg-[#D66565]/[0.035] text-[#C97878]' : 'border-[#72B6A0]/20 bg-[#72B6A0]/[0.03] text-[#78B39F]'}`}>
                  {scrutiny ? 'ELEVATED SCRUTINY' : 'COHERENT'}
                </span>
                <span className="font-mono text-[6px] uppercase tracking-[0.15em] text-[#46515B]">{contradicting} counter-evidence · {activeFeeds?.length || 0} source feeds</span>
              </div>
              <Kicker>Current judgment</Kicker>
              <div className="mt-2 max-w-4xl text-[18px] leading-snug tracking-[-0.02em] text-[#E8ECEF] md:text-[23px]">
                {situationJudgment}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-[#68737D]">
                {scrutiny ? <ArrowDownRight className="h-3.5 w-3.5 text-[#D66565]" /> : <ArrowUpRight className="h-3.5 w-3.5 text-[#72B6A0]" />}
                <span>{scrutiny ? 'Do not escalate without Council review.' : 'No major contradiction threshold breach.'}</span>
              </div>
            </div>

            <div className="p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <Kicker>Top 3 changes</Kicker>
                <Sparkles className="h-3.5 w-3.5 text-[#5D6873]" />
              </div>
              <div className="space-y-1">
                {rankedSignals.slice(0, 3).map((signal: any, index: number) => (
                  <button key={signal.id} onClick={() => setCurrentView('oracle-field')} className="flex w-full items-start gap-3 border-t border-white/[0.045] py-2.5 text-left first:border-t-0 first:pt-0">
                    <span className="mt-0.5 font-mono text-[7px] text-[#45505A]">0{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block line-clamp-1 text-[10px] text-[#B5BEC6]">{signal.title}</span>
                      <span className="mt-1 block font-mono text-[6px] uppercase tracking-[0.12em] text-[#4E5963]">strength {Math.round(signal.signalStrength || 0)} · urgency {Math.round(signal.urgency || 0)}</span>
                    </span>
                  </button>
                ))}
                {!rankedSignals.length && <div className="py-3 text-[10px] text-[#4E5963]">No ranked change detected.</div>}
              </div>
            </div>
          </div>
        </Panel>

        <div className="mb-4 grid grid-cols-2 gap-px border border-white/[0.07] bg-white/[0.07] md:grid-cols-4">
          {[
            { label: 'System health', value: `${Math.round(healthScore)}%`, icon: ShieldCheck, sub: `${activeFeeds?.length || 0} source feeds` },
            { label: 'Avg confidence', value: `${avgConfidence}%`, icon: BrainCircuit, sub: `${hypotheses?.length || 0} hypotheses` },
            { label: 'Contradiction', value: `${contradictionShare}%`, icon: CircleAlert, sub: `${contradicting} evidence items` },
            { label: 'Field volume', value: `${sources?.length || 0}`, icon: Database, sub: `${signals?.length || 0} active signals` },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-[#070B10] p-4 md:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <Kicker>{item.label}</Kicker>
                  <Icon className="h-3.5 w-3.5 text-[#4F5A64]" />
                </div>
                <div className="font-mono text-[23px] tracking-[-0.04em] text-[#E4E9ED] md:text-[29px]">{item.value}</div>
                <div className="mt-1 text-[9px] text-[#535E68]">{item.sub}</div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
          <Panel className="min-h-[350px] p-5 md:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <Kicker>Priority forecast</Kicker>
                <h2 className="mt-2 text-[16px] font-medium text-[#E4E9ED]">Highest-conviction active judgment</h2>
              </div>
              <Radar className="h-4 w-4 text-[#43D9E6]" />
            </div>

            {topPrediction ? (
              <div className="grid gap-6 md:grid-cols-[1fr_180px] md:items-center">
                <div>
                  <div className="max-w-3xl text-[19px] leading-snug tracking-[-0.025em] text-[#EBEFF2] md:text-[25px]">{topPrediction.statement}</div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="border-l border-white/[0.09] pl-3">
                      <Kicker>Validation</Kicker>
                      <p className="mt-1 text-[10px] leading-relaxed text-[#84909A]">{topPrediction.validationCondition || 'No explicit validation condition.'}</p>
                    </div>
                    <div className="border-l border-[#D66565]/20 pl-3">
                      <Kicker>Invalidation</Kicker>
                      <p className="mt-1 text-[10px] leading-relaxed text-[#84909A]">{topPrediction.invalidationCondition || 'No explicit invalidation condition.'}</p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/[0.07] pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <Kicker>Probability</Kicker>
                  <div className="mt-1 font-mono text-[46px] tracking-[-0.07em] text-[#E6EBEE]">{Math.round(topPrediction.probability || 0)}<span className="text-[15px] text-[#5A6570]">%</span></div>
                  <div className="mt-3 h-px w-full bg-white/[0.08]">
                    <div className="h-px bg-[#43D9E6]" style={{ width: `${clamp(topPrediction.probability || 0)}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between font-mono text-[7px] uppercase tracking-[0.14em] text-[#56616C]">
                    <span>confidence</span><span className="text-[#9EA8B1]">{Math.round(topPrediction.confidence || 0)}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center border border-dashed border-white/[0.08] text-[10px] text-[#535E68]">No active prediction yet.</div>
            )}
          </Panel>

          <Panel className="p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <Kicker>Evidence balance</Kicker>
                <h2 className="mt-2 text-[15px] font-medium text-[#DFE4E8]">Support vs contradiction</h2>
              </div>
              <Activity className="h-4 w-4 text-[#63707B]" />
            </div>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex justify-between font-mono text-[8px] uppercase tracking-[0.13em]"><span className="text-[#65707A]">supporting</span><span className="text-[#78B39F]">{supportShare}%</span></div>
                <div className="h-1 bg-white/[0.06]"><div className="h-full bg-[#72B6A0]" style={{ width: `${supportShare}%` }} /></div>
              </div>
              <div>
                <div className="mb-2 flex justify-between font-mono text-[8px] uppercase tracking-[0.13em]"><span className="text-[#65707A]">contradicting</span><span className="text-[#C97878]">{contradictionShare}%</span></div>
                <div className="h-1 bg-white/[0.06]"><div className="h-full bg-[#D66565]" style={{ width: `${contradictionShare}%` }} /></div>
              </div>
              <div className="border-t border-white/[0.06] pt-4 text-[10px] leading-relaxed text-[#6E7983]">
                Contradiction is decision information, not noise. High-conflict cases move to Council before escalation.
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between"><Kicker>Signal pulse</Kicker><Sparkles className="h-3.5 w-3.5 text-[#43D9E6]" /></div>
            <div className="space-y-1">
              {rankedSignals.map((signal: any, index: number) => (
                <button key={signal.id} onClick={() => setCurrentView('oracle-field')} className="group flex w-full items-center gap-3 border-t border-white/[0.05] py-3 text-left first:border-t-0 first:pt-0">
                  <span className="font-mono text-[8px] text-[#45505A]">0{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-[#B4BDC5] group-hover:text-[#E8ECEF]">{signal.title}</span>
                  <span className="font-mono text-[8px] text-[#6C7882]">{Math.round(signal.signalStrength || 0)}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between"><Kicker>Hypothesis stack</Kicker><BrainCircuit className="h-3.5 w-3.5 text-[#777F9C]" /></div>
            <div className="space-y-3">
              {rankedHypotheses.map((item: any) => (
                <button key={item.id} onClick={() => setCurrentView('cases')} className="w-full border-l border-white/[0.08] pl-3 text-left hover:border-[#43D9E6]/30">
                  <div className="line-clamp-2 text-[10px] leading-relaxed text-[#B2BBC3]">{item.title}</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.11em] text-[#56616C]"><span>{Math.round(item.confidence || 0)}% confidence</span><span>·</span><span>{item.status || 'active'}</span></div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between"><Kicker>Decision memory</Kicker><GitBranch className="h-3.5 w-3.5 text-[#B89E69]" /></div>
            <div className="space-y-3">
              {(reports || []).slice(-3).reverse().map((report: any, index: number) => (
                <button key={report.id || index} onClick={() => setCurrentView('ledger')} className="flex w-full gap-3 text-left">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#535E68]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] text-[#B0B9C1]">{report.title}</span>
                    <span className="mt-1 block font-mono text-[7px] uppercase tracking-[0.12em] text-[#4E5963]">{report.date || report.type || 'ledger event'}</span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
