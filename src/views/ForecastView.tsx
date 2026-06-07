import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useAppContext } from '../store';
import { ArrowLeft, Target, ShieldAlert, Cpu, Activity, Database, CheckCircle, XCircle, TrendingUp, AlertCircle, Clock, X, FileText } from 'lucide-react';
import { CosmosVisualizer } from '../components/CosmosVisualizer';
import { SmoothTrendChart } from '../components/SmoothTrendChart';
import { ProbabilityGauge } from '../components/ProbabilityGauge';

export const ForecastView: React.FC = () => {
  const { questions, hypotheses, scenarios, evidence, selectedEntity, setCurrentView, sources, signals, reports } = useAppContext() as any;
  const [scenIndex, setScenIndex] = useState(0);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Automatically select the report that is linked to the current focalData (e.g. via topSignalId)
  useEffect(() => {
    if (!reports) return;
    // We can auto-select if there is a report matching the current focus
    // if selectedEntity is a signal and there's a matching report
    if (selectedEntity?.type === 'signal') {
       const matchedReport = reports.find((r: any) => r.topSignalId === selectedEntity.id);
       if (matchedReport) setSelectedReportId(matchedReport.id);
    }
  }, [selectedEntity, reports]);

  // Reset index when data changes
  useEffect(() => {
    setScenIndex(0);
  }, [selectedEntity]);

  const focalData = useMemo(() => {
    let focusQ = questions.length > 0 ? questions[questions.length - 1] : undefined;
    
    if (selectedEntity) {
      if (selectedEntity.type === 'source') {
         const source = sources?.find((s: any) => s.id === selectedEntity.id);
         if (source?.linkedQuestionIds?.length > 0) {
            focusQ = questions.find((q: any) => q.id === source.linkedQuestionIds[0]) || focusQ;
         } else if (source?.linkedSignalIds?.length > 0) {
            const sig = signals?.find((s: any) => s.id === source.linkedSignalIds[0]);
            if (sig?.linkedQuestionIds?.length > 0) {
               focusQ = questions.find((q: any) => q.id === sig.linkedQuestionIds[0]) || focusQ;
            }
         }
      } else if (selectedEntity.type === 'signal') {
         const sig = signals?.find((s: any) => s.id === selectedEntity.id);
         if (sig?.linkedQuestionIds?.length > 0) {
            focusQ = questions.find((q: any) => q.id === sig.linkedQuestionIds[0]) || focusQ;
         }
      } else if (selectedEntity.type === 'question') {
         focusQ = questions.find((q: any) => q.id === selectedEntity.id) || focusQ;
      } else if (selectedEntity.type === 'hypothesis') {
         const hyp = hypotheses.find((h: any) => h.id === selectedEntity.id);
         if (hyp) {
            focusQ = questions.find((q: any) => q.id === hyp.questionId) || focusQ;
         }
      } else if (selectedEntity.type === 'branch' || selectedEntity.type === 'scenario') {
         const scen = scenarios.find((s: any) => s.id === selectedEntity.id);
         if (scen) {
            const hyp = hypotheses.find((h: any) => h.id === scen.hypothesisId);
            if (hyp) {
               focusQ = questions.find((q: any) => q.id === hyp.questionId) || focusQ;
            }
         }
      }
    }

    let focusH = hypotheses.filter((h: any) => h.questionId === focusQ?.id);
    let focusS = scenarios.filter((s: any) => focusH.some((h: any) => h.id === s.hypothesisId));

    if (selectedEntity) {
       if (selectedEntity.type === 'hypothesis') {
          focusH = focusH.filter((h: any) => h.id === selectedEntity.id);
          focusS = scenarios.filter((s: any) => focusH.some((h: any) => h.id === s.hypothesisId));
       } else if (selectedEntity.type === 'branch' || selectedEntity.type === 'scenario') {
          const scen = scenarios.find((s: any) => s.id === selectedEntity.id);
          if (scen) {
             focusH = focusH.filter((h: any) => h.id === scen.hypothesisId);
             focusS = [scen];
          }
       }
    }

    return { focusQ, focusH, focusS };
  }, [selectedEntity, questions, hypotheses, scenarios, sources, signals]);

  const { focusQ, focusH, focusS } = focalData;

  if (!focusQ) {
    return <div className="p-8 text-white h-screen bg-[#020510]">No active data.</div>;
  }

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar bg-[#020510] relative flex flex-col items-center">
          
          {/* Immersive Background */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
         <div className="absolute top-[-10%] left-[20%] w-[800px] h-[800px] rounded-full bg-gradient-to-br from-blue-900/20 to-transparent" />
         <div className="absolute bottom-[10%] right-[10%] w-[1000px] h-[1000px] rounded-full bg-gradient-to-tl from-cyan-900/10 to-transparent" />
      </div>

      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[2px] h-full bg-gradient-to-b from-blue-900/50 via-blue-900/10 to-transparent pointer-events-none" />

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && selectedReportId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            {(() => {
              const r = reports?.find((rx: any) => rx.id === selectedReportId);
              if (!r) return null;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className="w-full max-w-4xl bg-[#080b14] border border-blue-900/50 rounded-2xl md:rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.15)] flex flex-col max-h-[90vh] overflow-hidden"
                >
                  <div className="flex justify-between items-center p-6 md:p-8 border-b border-white/5 shrink-0 bg-[#050810]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-950/40 border border-blue-900/50 rounded-xl text-blue-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-[10px] md:text-xs font-mono text-cyan-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                          {r.type.toUpperCase()}
                        </div>
                        <h2 className="text-xl md:text-2xl font-sans text-white font-medium leading-snug">{r.title}</h2>
                      </div>
                    </div>
                    <button onClick={() => setIsReportModalOpen(false)} className="text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 md:p-3 rounded-xl border border-white/10 shrink-0">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Publish Date</div>
                        <div className="text-sm font-sans text-gray-300">{new Date(r.date).toLocaleString()}</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Probability Shift</div>
                        <div className="text-sm font-sans text-cyan-400">{r.scenarioProbabilityChange}</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Watch Next</div>
                        <div className="text-sm font-sans text-orange-400 line-clamp-2">{r.watchNext}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="text-[11px] font-mono text-blue-400 uppercase tracking-widest flex items-center gap-2 border-b border-blue-900/30 pb-3">
                        <Database className="w-4 h-4" /> Executive Summary & Intelligence Content
                      </div>
                      <div className="text-[15px] md:text-[16px] font-sans text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {r.content}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full max-w-6xl pt-6 md:pt-12 pb-4 md:pb-8 px-4 md:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between sticky top-0 bg-[#020510]/80 backdrop-blur-xl z-50 border-b border-blue-900/40 gap-4">
         <div className="flex items-center gap-3 md:gap-6">
            <button onClick={() => setCurrentView('watchlist')} className="text-blue-400 hover:text-white hover:bg-blue-900/50 transition-all bg-blue-950/30 p-2 md:p-3 rounded-full border border-blue-800/50 shadow-lg shrink-0">
               <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <h2 className="text-lg md:text-2xl font-display text-white tracking-widest uppercase items-center flex gap-2 md:gap-4 font-bold shrink-0">
               <Activity className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
               <span className="hidden lg:inline">분석 딥 다이브 (DEEP DIVE)</span>
               <span className="lg:hidden">딥 다이브</span>
            </h2>
         </div>
         <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2">
               <span className="text-[10px] md:text-xs font-mono text-cyan-500 uppercase tracking-widest hidden sm:inline">대상 보고서:</span>
               <select 
                  className="bg-blue-950/30 text-cyan-300 font-mono text-[10px] md:text-xs border border-blue-800/50 rounded-lg px-2 py-1.5 md:px-3 md:py-2 focus:outline-none focus:border-cyan-500 transition-colors shadow-lg shadow-blue-900/20 appearance-none min-w-[140px] cursor-pointer"
                  value={selectedReportId}
                  onChange={(e) => {
                    setSelectedReportId(e.target.value);
                    if (e.target.value) setIsReportModalOpen(true);
                  }}
               >
                  <option value="">연관 보고서 선택 (Select Report)...</option>
                  {reports?.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
               </select>
               <button 
                  onClick={() => selectedReportId && setIsReportModalOpen(true)}
                  className={`bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-800 text-cyan-300 rounded-lg px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-mono uppercase tracking-widest transition-colors font-bold whitespace-nowrap ${!selectedReportId ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  열람 (View)
               </button>
            </div>
            <div className="text-[10px] md:text-[12px] font-mono text-blue-300/80 uppercase tracking-widest text-right flex flex-col gap-1 bg-blue-950/30 px-2 md:px-4 py-1.5 md:py-2 rounded-lg border border-blue-900/50 shrink-0">
               <div className="flex items-center gap-2 justify-end"><span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500 animate-pulse" /> <span className="hidden sm:inline">ACTIVE ANALYSIS</span></div>
               <div><span className="hidden sm:inline">NODE ID: </span>{selectedEntity?.id || 'ROOT'}</div>
            </div>
         </div>
      </div>

      <div className="w-full max-w-6xl py-8 md:py-16 px-4 md:px-8 flex flex-col gap-12 md:gap-24 relative z-10">
        
        {/* Level 1: QUESTION (WHY) */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative flex flex-col items-center">
           <div className="bg-[#050a1f]/80 backdrop-blur-2xl border-t-4 border-t-violet-500 rounded-2xl md:rounded-3xl p-6 md:p-10 w-full md:w-[85%] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-blue-900/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-violet-900/20 to-transparent rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
              <div className="absolute right-0 bottom-0 opacity-40 mix-blend-screen pointer-events-none translate-y-1/4">
                <SmoothTrendChart color="#8b5cf6" probability={50} width={400} height={150} />
              </div>
              
              <div className="flex justify-between items-center mb-6 md:mb-8 pb-4 md:pb-6 border-b border-blue-900/40 relative z-10 w-full">
                 <div className="text-[11px] md:text-[13px] font-mono text-violet-400 font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] flex items-center gap-2">
                   <AlertCircle className="w-4 h-4" /> 분석 핵심 질문
                 </div>
                 <div className="flex flex-col items-center justify-center -mt-8">
                    <ProbabilityGauge value={focusH.length > 0 ? focusH.reduce((acc, h) => acc + (h.confidence||0), 0) / focusH.length : 50} label="종합 예측 강도" size={130} colorPrimary="#8b5cf6" colorSecondary="#3b82f6" />
                 </div>
              </div>
              <h3 className="text-xl md:text-3xl font-sans text-white leading-snug font-light relative z-10 drop-shadow-md">{focusQ.text}</h3>
           </div>
           {/* Vertical Connector */}
           <div className="w-1 h-12 md:h-24 bg-gradient-to-b from-violet-500/80 to-blue-500/20 shadow-[0_0_15px_#8b5cf6]" />
        </motion.div>

        {/* Level 2: HYPOTHESIS (HOW) */}
        <div className="flex flex-col lg:flex-row justify-center gap-8 md:gap-12 w-full">
           {focusH.map((hyp, i) => {
             const conf = hyp.confidence || 0;
             let theme = 'blue';
             
             if (conf >= 75) {
                theme = 'cyan';
             } else if (conf >= 45) {
                theme = 'indigo';
             } else {
                theme = 'gray';
             }

             const themeMap: Record<string, any> = {
                cyan: {
                   container: 'from-[#082f49] to-[#041c2c] border-cyan-800/40 hover:border-cyan-500/60',
                   bgGlow: 'bg-cyan-900/10',
                   textPrimary: 'text-cyan-400',
                   textSecondary: 'text-cyan-500',
                   barContainer: 'border-cyan-900/30',
                   barFill: 'from-cyan-600 to-cyan-400',
                   glowHex: '#22d3ee',
                   flex: 'flex-[1.2]'
                },
                indigo: {
                   container: 'from-[#1e1b4b] to-[#0f172a] border-indigo-800/40 hover:border-indigo-500/60',
                   bgGlow: 'bg-indigo-900/10',
                   textPrimary: 'text-indigo-400',
                   textSecondary: 'text-indigo-500',
                   barContainer: 'border-indigo-900/30',
                   barFill: 'from-indigo-600 to-indigo-400',
                   glowHex: '#818cf8',
                   flex: 'flex-[1]'
                },
                gray: {
                   container: 'from-[#111827] to-[#030712] border-gray-800/40 hover:border-gray-500/60',
                   bgGlow: 'bg-gray-900/10',
                   textPrimary: 'text-gray-400',
                   textSecondary: 'text-gray-500',
                   barContainer: 'border-gray-900/30',
                   barFill: 'from-gray-600 to-gray-400',
                   glowHex: '#9ca3af',
                   flex: 'flex-[0.8]'
                },
                blue: {
                   container: 'from-[#1e3a8a] to-[#0f172a] border-blue-800/40 hover:border-blue-500/60',
                   bgGlow: 'bg-blue-900/10',
                   textPrimary: 'text-blue-400',
                   textSecondary: 'text-blue-500',
                   barContainer: 'border-blue-900/30',
                   barFill: 'from-blue-600 to-blue-400',
                   glowHex: '#3b82f6',
                   flex: 'flex-1'
                }
             };

             const t = themeMap[theme] || themeMap.blue;

             return (
             <motion.div key={hyp.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`flex flex-col relative w-full lg:max-w-lg ${t.flex}`}>
                <div className={`bg-gradient-to-br ${t.container} backdrop-blur-2xl border flex-1 rounded-2xl md:rounded-3xl p-6 md:p-8 transition-all shadow-2xl relative overflow-hidden group`}>
                   <div className={`absolute inset-0 ${t.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
                   <div className="absolute right-0 bottom-0 opacity-40 mix-blend-screen pointer-events-none translate-y-1/4 translate-x-1/4">
                     <SmoothTrendChart color={t.glowHex} probability={conf} width={300} height={120} />
                   </div>
                   
                   <div className="flex justify-between items-center mb-4 md:mb-6 relative z-10 w-full overflow-hidden">
                      <div className={`text-[11px] md:text-[12px] font-mono font-bold ${t.textPrimary} uppercase tracking-widest flex items-center gap-2 `}>
                         <Target className="w-4 h-4"/> 제안 가설
                      </div>
                      <div className="flex flex-col items-center justify-center -mt-8">
                         <ProbabilityGauge value={conf} label="신뢰도" size={130} colorPrimary={t.glowHex} colorSecondary="#4c1d95" />
                      </div>
                   </div>

                   <h4 className="text-lg md:text-xl font-sans text-white leading-relaxed mb-4 font-medium">{hyp.title}</h4>
                   
                   <div className="mt-6 md:mt-8 space-y-2 md:space-y-3">
                      <div className="text-[10px] md:text-[11px] font-mono font-bold text-gray-500 uppercase tracking-widest border-b border-blue-900/40 pb-2 mb-3 md:mb-4">핵심 검증 지표</div>
                      {evidence.filter(e => e.linkedHypothesisId === hyp.id || (e as any).hypothesisId === hyp.id).slice(0, 3).map((ev, ei) => (
                        <div key={ev.id} className="flex gap-3 items-center bg-blue-950/20 p-2.5 md:p-3 rounded-xl border border-blue-900/30 hover:bg-blue-900/40 transition-colors">
                           {ev.evidenceType === 'supporting' ? 
                             <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-cyan-950 flex items-center justify-center border border-cyan-800 shrink-0"><CheckCircle className="w-3 h-3 text-cyan-400" /></div> : 
                             <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-red-950 flex items-center justify-center border border-red-800 shrink-0"><XCircle className="w-3 h-3 text-red-400" /></div>
                           }
                           <div className="text-[12px] md:text-[13px] font-sans text-gray-300 leading-snug flex-1">{ev.title}</div>
                        </div>
                      ))}
                   </div>
                </div>
                {/* Connector down to scenarios */}
                {focusS.some(s => s.hypothesisId === hyp.id) && (
                  <div className="w-1 h-12 md:h-24 bg-gradient-to-b from-blue-500/50 to-transparent mx-auto mt-[-2px] relative z-0" />
                )}
             </motion.div>
           );
           })}
        </div>

        {/* Level 3: SCENARIOS (WHAT) */}
        <div className="flex flex-col items-center gap-10 w-full mb-12">
           <div className="text-[12px] font-mono text-cyan-500 uppercase tracking-widest flex items-center gap-3 bg-cyan-900/30 px-6 py-3 rounded-full border border-cyan-800/50">
             <Activity className="w-4 h-4 animate-pulse" /> 투영된 주요 시나리오 ({focusS.length}건)
           </div>
           
           <div className="w-full relative min-h-[600px] flex justify-center perspective-1000">
             {focusS.length > 1 && (
               <div className="flex absolute top-[10px] items-center gap-4 bg-[#0a0f24]/80 px-6 py-2.5 rounded-[24px] border border-blue-900/40 backdrop-blur-xl z-50 shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-cyan-500/50 transition-colors">
                 <span className="text-[10px] md:text-[11px] font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 drop-shadow">
                   <Activity className="w-3.5 h-3.5 animate-pulse" /> 분석 파노라마 조향
                 </span>
                 <input 
                   type="range" 
                   min="0" 
                   max={focusS.length - 1} 
                   value={scenIndex} 
                   onChange={(e) => setScenIndex(parseInt(e.target.value))}
                   className="w-32 md:w-48 h-1.5 appearance-none bg-blue-950/80 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(34,211,238,0.8)] border border-blue-900/50 mx-2"
                 />
                 <span className="text-xs font-mono text-white tracking-widest flex items-center">
                   <span className="font-bold">{scenIndex + 1}</span> <span className="text-gray-500 text-[10px] ml-1">/ {focusS.length}</span>
                 </span>
               </div>
             )}
             <AnimatePresence mode="wait">
               {focusS.length > 0 && (
                 <motion.div
                   key={`scen-${focusS[scenIndex]?.id}`}
                   initial={{ opacity: 0, rotateX: 10, scale: 0.95 }}
                   animate={{ opacity: 1, rotateX: 0, scale: 1 }}
                   exit={{ opacity: 0, rotateX: -10, scale: 0.95 }}
                   transition={{ duration: 0.5, ease: "easeOut" }}
                   className="w-full lg:w-[70%]"
                 >
                   {(() => {
                     const scen = focusS[scenIndex];
                     if (!scen) return null;
                     const isRisk = scen.probability >= 35;
                     const isCritical = scen.probability >= 65;
             
             let theme = {
                border: 'border-blue-900/50 hover:border-blue-500/50',
                bg: 'bg-gradient-to-b from-[#050a1f] to-black',
                accentText: 'text-blue-400',
                glow: 'drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]',
                icon: <TrendingUp className="w-5 h-5 text-blue-500" />
             };

             if (isCritical) {
                theme = {
                   border: 'border-red-900/70 hover:border-red-500/70',
                   bg: 'bg-gradient-to-b from-red-950/40 to-black',
                   accentText: 'text-red-400',
                   glow: 'drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]',
                   icon: <ShieldAlert className="w-5 h-5 text-red-500" />
                };
             } else if (isRisk) {
                theme = {
                   border: 'border-orange-900/60 hover:border-orange-500/60',
                   bg: 'bg-gradient-to-b from-orange-950/30 to-black',
                   accentText: 'text-orange-400',
                   glow: 'drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]',
                   icon: <AlertCircle className="w-5 h-5 text-orange-500" />
                };
             }

                     return (
                       <div className={`flex flex-col w-full ${theme.bg} border-2 ${theme.border} rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden relative group`}>
                          
                          {/* Dashboard-style Top Section */}
                          <div className="p-8 md:p-12 border-b border-white/5 relative z-10 flex flex-col gap-6">
                             <div className="absolute right-[-60px] top-[-60px] opacity-20 pointer-events-none mix-blend-screen transition-transform duration-1000 group-hover:scale-110 z-0">
                                <CosmosVisualizer seed={scen.id} color={isCritical ? '#ef4444' : isRisk ? '#f97316' : '#3b82f6'} size={500} />
                             </div>
                             <div className="flex justify-between items-start relative z-10 mb-2">
                                <div className="flex items-center gap-3">
                                   {theme.icon}
                                   <div className="text-[12px] md:text-[14px] font-mono font-bold text-gray-400 uppercase tracking-widest">투영 시나리오 상세 분석</div>
                                </div>
                                <div className="flex flex-col items-center justify-center -mt-6">
                                   <ProbabilityGauge value={scen.probability} label="발생 예측 확률" size={160} colorPrimary={isCritical ? "#ef4444" : isRisk ? "#f97316" : "#3b82f6"} colorSecondary="#a855f7" />
                                </div>
                             </div>
                             <h4 className="text-2xl md:text-3xl font-sans text-white font-medium leading-tight">{scen.title}</h4>
                          </div>
                          
                          {/* Beautiful Data Layout Body */}
                          <div className="p-8 md:p-12 flex flex-col gap-8 relative z-10 bg-black/40">
                             <div className="flex flex-col gap-6">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                                   <div className="text-[11px] md:text-[13px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-3"><Database className="w-4 h-4" /> 예상 트리거 조건 (Trigger Condition)</div>
                                   <div className="text-[15px] md:text-[17px] font-sans text-gray-200 leading-relaxed">{scen.triggerCondition || '해당 데이터 부족'}</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                                   <div className="text-[11px] md:text-[13px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-3"><Activity className="w-4 h-4" /> 파급 전망 (Expected Impact)</div>
                                   <div className="text-[15px] md:text-[17px] font-sans text-gray-200 leading-relaxed">{scen.expectedOutcome || '해당 데이터 부족'}</div>
                                </div>
                             </div>
                             
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-white/10">
                                <div>
                                   <div className="text-[11px] md:text-[13px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> 무효화/전환 지점</div>
                                   <div className="text-[14px] md:text-[15px] font-sans text-orange-400/90 leading-relaxed bg-orange-950/20 p-5 rounded-xl border border-orange-900/30">{scen.invalidationCondition || '분석 진행 중...'}</div>
                                </div>
                                <div>
                                   <div className="text-[11px] md:text-[13px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Target className="w-4 h-4" /> 모니터링 주요 지표</div>
                                   <ul className="text-[14px] md:text-[15px] font-sans text-blue-300/80 leading-relaxed space-y-3 bg-blue-950/20 p-5 rounded-xl border border-blue-900/30">
                                     {scen.nextIndicators?.map((ind: string, k: number) => <li key={k} className="flex gap-3 items-start"><span className="text-blue-500 mt-1.5 text-[10px]">■</span>{ind}</li>) || <li>지표 수집 중...</li>}
                                   </ul>
                                </div>
                             </div>
                          </div>
                          
                          {/* Subtle decorative background elements */}
                          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-white/5 to-transparent rounded-full blur-[60px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                       </div>
                     );
                   })()}
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
           
         </div>
      </div>
      </div>
  );
};



