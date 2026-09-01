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
  <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#66717D]">{children}</div>
);

export const CommandCenterView: React.FC = () => {
  const {
    sources,
    signals,
    hypotheses,
    evidence,
    scenarios,
    predictions,
    reports,
    setCurrentView,
    activeFeeds,
  } = useAppContext() as any;

  const rankedSignals = [...(signals || [])]
    .sort((a: any, b: any) => (b.signalStrength + b.urgency) - (a.signalStrength + a.urgency))
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

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_70%_0%,rgba(67,217,230,0.045),transparent_34%),#05070A] pb-28 lg:pb-14">
      <div className="mx-auto w-full max-w-[1560px] px-4 py-5 md:px-6 md:py-7 xl:px-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="mb-5 flex flex-col justify-between gap-4 border-b border-white/[0.06] pb-5 md:flex-row md:items-end"
        >
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.24em] text-[#43D9E6]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#43D9E6] shadow-[0_0_10px_rgba(67,217,230,.55)]" />
              Decision operating system
            </div>
            <h1 className="text-[28px] font-medium tracking-[-0.035em] text-[#F1F4F7] sm:text-[36px]">Command</h1>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#707B86] sm:text-[13px]">
              What changed, what matters, and where the evidence is pulling the system now.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentView('oracle-field')} className="border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[#88939E] hover:text-[#E5EBF0]">
              Open field
            </button>
            <button onClick={() => setCurrentView('forecast')} className="border border-[#43D9E6]/20 bg-[#43D9E6]/[0.04] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[#8DDBE2] hover:border-[#43D9E6]/35">
              Review forecasts
            </button>
          </div>
        </motion.div>

        <div className="mb-4 grid grid-cols-2 gap-px border border-white/[0.07] bg-white/[0.07] md:grid-cols-4">
          {[
            { label: 'System health', value: `${Math.round(healthScore)}%`, icon: ShieldCheck, sub: `${activeFeeds?.length || 0} live feeds` },
            { label: 'Avg confidence', value: `${avgConfidence}%`, icon: BrainCircuit, sub: `${hypotheses?.length || 0} hypotheses` },
            { label: 'Contradiction', value: `${contradictionShare}%`, icon: CircleAlert, sub: `${contradicting} evidence items` },
            { label: 'Field volume', value: `${sources?.length || 0}`, icon: Database, sub: `${signals?.length || 0} active signals` },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-[#070B10] p-4 md:p-5">
                <div className="mb-5 flex items-center justify-between">
                  <Kicker>{item.label}</Kicker>
                  <Icon className="h-3.5 w-3.5 text-[#53606C]" />
                </div>
                <div className="font-mono text-[24px] tracking-[-0.04em] text-[#E9EDF1] md:text-[30px]">{item.value}</div>
                <div className="mt-1 text-[10px] text-[#59636E]">{item.sub}</div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
          <Panel className="min-h-[360px] p-5 md:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <Kicker>Priority forecast</Kicker>
                <h2 className="mt-2 text-[17px] font-medium text-[#E8EDF2]">Highest-conviction active judgment</h2>
              </div>
              <Radar className="h-4 w-4 text-[#43D9E6]" />
            </div>

            {topPrediction ? (
              <div className="grid gap-6 md:grid-cols-[1fr_180px] md:items-center">
                <div>
                  <div className="max-w-3xl text-[20px] leading-snug tracking-[-0.025em] text-[#EFF3F6] md:text-[26px]">{topPrediction.statement}</div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="border-l border-white/[0.09] pl-3">
                      <Kicker>Validation</Kicker>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#89939D]">{topPrediction.validationCondition || 'No explicit validation condition.'}</p>
                    </div>
                    <div className="border-l border-[#D66565]/20 pl-3">
                      <Kicker>Invalidation</Kicker>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#89939D]">{topPrediction.invalidationCondition || 'No explicit invalidation condition.'}</p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/[0.07] pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <Kicker>Probability</Kicker>
                  <div className="mt-1 font-mono text-[48px] tracking-[-0.07em] text-[#EAF0F3]">{Math.round(topPrediction.probability || 0)}<span className="text-[16px] text-[#5E6974]">%</span></div>
                  <div className="mt-3 h-px w-full bg-white/[0.08]">
                    <div className="h-px bg-[#43D9E6]" style={{ width: `${clamp(topPrediction.probability || 0)}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.15em] text-[#5C6671]">
                    <span>confidence</span><span className="text-[#AAB3BC]">{Math.round(topPrediction.confidence || 0)}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center border border-dashed border-white/[0.08] text-[11px] text-[#5A6570]">No active prediction yet.</div>
            )}
          </Panel>

          <Panel className="p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <Kicker>Evidence balance</Kicker>
                <h2 className="mt-2 text-[16px] font-medium text-[#E4E9ED]">Support vs contradiction</h2>
              </div>
              <Activity className="h-4 w-4 text-[#687480]" />
            </div>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em]"><span className="text-[#69747F]">supporting</span><span className="text-[#83C6B0]">{supportShare}%</span></div>
                <div className="h-1 bg-white/[0.06]"><div className="h-full bg-[#83C6B0]" style={{ width: `${supportShare}%` }} /></div>
              </div>
              <div>
                <div className="mb-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em]"><span className="text-[#69747F]">contradicting</span><span className="text-[#D88181]">{contradictionShare}%</span></div>
                <div className="h-1 bg-white/[0.06]"><div className="h-full bg-[#D66565]" style={{ width: `${contradictionShare}%` }} /></div>
              </div>
              <div className="border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-[#727D87]">
                Contradiction is treated as signal quality information, not noise. High-conflict cases should move to Council before action.
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
                  <span className="font-mono text-[9px] text-[#48535E]">0{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-[#BFC7CE] group-hover:text-[#EDF1F4]">{signal.title}</span>
                  <span className="font-mono text-[9px] text-[#72808B]">{Math.round(signal.signalStrength || 0)}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between"><Kicker>Hypothesis stack</Kicker><BrainCircuit className="h-3.5 w-3.5 text-[#8B79C8]" /></div>
            <div className="space-y-3">
              {rankedHypotheses.map((item: any) => (
                <button key={item.id} onClick={() => setCurrentView('cases')} className="w-full border-l border-white/[0.08] pl-3 text-left hover:border-[#43D9E6]/35">
                  <div className="line-clamp-2 text-[11px] leading-relaxed text-[#B9C1C8]">{item.title}</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-[#596570]"><span>{Math.round(item.confidence || 0)}% confidence</span><span>·</span><span>{item.status || 'active'}</span></div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between"><Kicker>Decision memory</Kicker><GitBranch className="h-3.5 w-3.5 text-[#C4A66A]" /></div>
            <div className="space-y-3">
              {(reports || []).slice(-3).reverse().map((report: any, index: number) => (
                <button key={report.id || index} onClick={() => setCurrentView('ledger')} className="flex w-full gap-3 text-left">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5A6570]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] text-[#B8C0C7]">{report.title}</span>
                    <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.13em] text-[#515C67]">{report.date || report.type || 'ledger event'}</span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <Panel className="mt-4 p-5 md:p-6">
          <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
            <div>
              <Kicker>System implication</Kicker>
              <div className="mt-2 flex items-center gap-2 text-[15px] text-[#E2E7EB]">
                {contradictionShare > 25 ? <ArrowDownRight className="h-4 w-4 text-[#D66565]" /> : <ArrowUpRight className="h-4 w-4 text-[#83C6B0]" />}
                {contradictionShare > 25 ? 'Increase scrutiny' : 'Evidence remains coherent'}
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-[#727D87]">
              {topSignal
                ? `Highest-priority live signal is “${topSignal.title}”. Review its evidence trail before escalating the associated forecast or execution path.`
                : 'The field currently has no ranked signal requiring immediate escalation.'}
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
};
