import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';
import { Hypothesis, ScenarioBranch } from '../types';

export const HypothesisSummaryView: React.FC = () => {
    const { hypotheses, scenarios } = useAppContext() as any;

    const rankedHypotheses = useMemo(() => {
        return (hypotheses || []).map((hyp: Hypothesis) => {
            const relatedScenarios = (scenarios || []).filter((s: ScenarioBranch) => s.hypothesisId === hyp.id || hyp.scenarioIds?.includes(s.id));
            const maxScenarioProb = relatedScenarios.length > 0 ? Math.max(...relatedScenarios.map((s: ScenarioBranch) => s.probability || 0)) : 0;
            const maxScenarioImpact = relatedScenarios.length > 0 ? Math.max(...relatedScenarios.map((s: ScenarioBranch) => s.impactScore || 0)) : 0;
            
            // Priority score based on hypothesis confidence, scenario prob and impact
            const priorityScore = (hyp.confidence || 0) * 0.4 + (maxScenarioProb * 0.4) + (maxScenarioImpact * 0.2);
            
            return {
                ...hyp,
                priorityScore,
                relatedScenarios
            };
        }).sort((a: any, b: any) => b.priorityScore - a.priorityScore);
    }, [hypotheses, scenarios]);

    return (
        <div className="w-full h-full p-4 md:p-8 overflow-y-auto bg-[#020510] relative text-gray-200">
            {/* Background elements */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-cyan-900/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-violet-900/10 blur-[120px]" />
            </div>

            <div className="max-w-7xl mx-auto relative z-10 flex flex-col gap-8">
                <header className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-widest uppercase">Core Hypothesis</h1>
                    <p className="text-sm text-cyan-400/80 font-mono tracking-wide">핵심 가설 요약: 과거 시나리오 및 확률 기반 우선순위 분석 분도결과</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {rankedHypotheses.length === 0 ? (
                        <div className="col-span-full py-20 flex justify-center text-gray-500 font-mono text-sm border border-white/5 rounded-xl bg-white/5 backdrop-blur-sm">
                            탐지된 가설이 없습니다.
                        </div>
                    ) : (
                        rankedHypotheses.map((hyp: any, index: number) => (
                            <motion.div
                                key={hyp.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: Math.min(index * 0.05, 1) }}
                                className="flex flex-col p-6 bg-black/60 border border-white/10 rounded-xl hover:border-cyan-500/50 transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.5)] group relative overflow-hidden backdrop-blur-md"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-transparent opacity-30 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="flex justify-between items-start mb-4 gap-4">
                                    <h3 className="text-lg font-bold text-gray-100 line-clamp-2 leading-snug group-hover:text-white transition-colors">{hyp.title}</h3>
                                    <div className="flex flex-col items-end shrink-0">
                                        <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Priority</div>
                                        <div className="text-xl font-bold text-cyan-400 font-mono bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/20">{hyp.priorityScore.toFixed(0)}</div>
                                    </div>
                                </div>
                                
                                <p className="text-sm text-gray-400 mb-6 line-clamp-3 leading-relaxed flex-1 font-sans">
                                    {hyp.description || hyp.title}
                                </p>

                                <div className="flex flex-col gap-3 mt-auto border-t border-white/5 pt-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase tracking-widest text-gray-600 mb-0.5 font-mono">Confidence</span>
                                            <span className={`text-sm font-bold font-mono ${hyp.confidence >= 70 ? 'text-green-400' : hyp.confidence >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{hyp.confidence}%</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] uppercase tracking-widest text-gray-600 mb-0.5 font-mono">Scenarios</span>
                                            <span className="text-sm font-bold text-gray-300 font-mono">{hyp.relatedScenarios.length}</span>
                                        </div>
                                    </div>
                                    
                                    {hyp.relatedScenarios.length > 0 && (
                                        <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/5">
                                            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-mono">Top Scenario</div>
                                            <div className="text-xs text-amber-100 leading-tight line-clamp-2">
                                                {hyp.relatedScenarios[0]?.title}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
