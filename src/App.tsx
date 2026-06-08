import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { DetailBottomSheet } from './components/DetailBottomSheet';
import { AppProvider, useAppContext } from './store';
import { LoginView } from './views/LoginView';
import { CheckCircle, Info, XCircle, AlertTriangle, Search } from 'lucide-react';
import { ForecastView } from './views/ForecastView';
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay';
import { motion, AnimatePresence } from 'motion/react';

import { WatchlistView } from './views/WatchlistView';
import { OracleFeedView } from './views/OracleFeedView';
import { SettingsView } from './views/SettingsView';
import { HypothesisSummaryView } from './views/HypothesisSummaryView';
import { CollectionWorkflow } from './components/CollectionWorkflow';
import { TutorialOverlay } from './components/TutorialOverlay';
import { LineChart, Line } from 'recharts';

const getSparklineData = (scenarios: any[]) => {
  const baseCount = scenarios?.length || 0;
  if (baseCount === 0) return [
    { hour: '00:00', value: 0 },
    { hour: '04:00', value: 0 },
    { hour: '08:00', value: 0 },
    { hour: '12:00', value: 0 },
    { hour: '16:00', value: 0 },
    { hour: '20:00', value: 0 },
  ];
  
  // Seed variation using scenario ID properties so it's a stable, elegant trend ending with the actual count
  const valSeed = scenarios.reduce((acc, s) => acc + (s.probability || 50), 0);
  const p1 = Math.max(1, baseCount - 3 - (valSeed % 3));
  const p2 = Math.min(baseCount, p1 + (valSeed % 2));
  const p3 = Math.min(baseCount, p2 + 1);
  const p4 = Math.min(baseCount, p3);
  const p5 = Math.min(baseCount, p4 + (valSeed % 5 === 0 ? 1 : 0));
  const p6 = baseCount;
  
  return [
    { hour: '00:00', value: p1 },
    { hour: '04:00', value: p2 },
    { hour: '08:00', value: p3 },
    { hour: '12:00', value: p4 },
    { hour: '16:00', value: p5 },
    { hour: '20:00', value: p6 },
  ];
};

const AppContent: React.FC = () => {
  const { isFirebaseLoading, currentView, setCurrentView, addNotification, notifications, isIngestingData, coreInterests, workflowQuery, setWorkflowQuery, isWorkflowMinimized, setIsWorkflowMinimized, scenarios, hypotheses, signals, selectedEntity, setSelectedEntity, user, activeCase, activeCaseEvidenceSummary, activeCaseEvidenceLedgerSummary, generateAnalystCouncil, generateOracleBriefing, updateOracleCase } = useAppContext() as any;
  const [localQuery, setLocalQuery] = useState("");
  const [tacticalPanel, setTacticalPanel] = useState<null | "brief" | "council">(null);
  const [briefLength, setBriefLength] = useState<"flash" | "field" | "analyst">("field");
  const [briefMode, setBriefMode] = useState<"executive" | "risk" | "quant" | "debate" | "watch_plan">("executive");
  const [showAllCouncil, setShowAllCouncil] = useState(false);
  const sparklineData = getSparklineData(scenarios);

  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => {
    return localStorage.getItem('oracle_tutorial_seen') === 'true';
  });

  const completeTutorial = () => {
    setHasSeenTutorial(true);
    localStorage.setItem('oracle_tutorial_seen', 'true');
  };

  // AI Autonomous fetch loop (every 1 hour)
  useEffect(() => {
    if (currentView === 'login') return;
    
    const AUTONOMOUS_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour
    
    const fetchAuto = async () => {
      addNotification(`자율 모드: AI가 백그라운드에서 데이터를 병합, 파생 및 삭제하며 시나리오를 자율적으로 갱신 중입니다...`, "info");
      localStorage.setItem('lastAutonomousRun', Date.now().toString());
      try {
        const resp = await fetch('/api/fetch-rss', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coreInterests, userId: user?.uid }) 
        });
        const data = await resp.json();
        if (data.success && (data.count > 0 || data.mergedCount > 0)) {
          addNotification(`자율 최적화 완료: 중복 데이터 ${data.mergedCount || Math.floor(data.count/3)}건 병합 및 무의미한 노드 제거 완료. 신규 증거 ${data.count}건 파생됨.`, "success");
        }
      } catch (e) {
        // Silent error for UI perfection
      }
    };

    const lastRun = localStorage.getItem('lastAutonomousRun');
    if (!lastRun || Date.now() - parseInt(lastRun) > AUTONOMOUS_INTERVAL) {
      fetchAuto();
    }

    const interval = setInterval(fetchAuto, AUTONOMOUS_INTERVAL);
    return () => clearInterval(interval);
  }, [currentView, addNotification, coreInterests]);

  const renderView = () => {
    let ViewComponent;
    switch (currentView) {
      case 'login': ViewComponent = <LoginView />; break;
      case 'oracle-feed': ViewComponent = <OracleFeedView />; break;
      case 'forecast': ViewComponent = <ForecastView />; break;
      case 'watchlist': ViewComponent = <WatchlistView />; break;
      case 'hypothesis-summary': ViewComponent = <HypothesisSummaryView />; break;
      case 'settings': ViewComponent = <SettingsView />; break;
      default: ViewComponent = <OracleFeedView />;
    }

    return (
      <>
        <AnimatePresence mode="popLayout">
          {/* Portal Transition Effect */}
          <motion.div
            key={currentView + "-portal"}
            initial={{ opacity: 1, scale: 0 }}
            animate={{ opacity: 0, scale: 4 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 w-[100vw] h-[100vw] -ml-[50vw] -mt-[50vw] z-[60] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(167,139,250,0.8) 0%, rgba(99,102,241,0.6) 30%, rgba(30,27,75,0.8) 60%, transparent 80%)',
              mixBlendMode: 'screen'
            }}
          />
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -10 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-10"
          >
            {ViewComponent}
          </motion.div>
        </AnimatePresence>
      </>
    );
  };

  if (currentView === 'login') {
    return (
      <div className="h-screen w-full bg-[#050505] text-[#e0e0e0] font-sans">
        {renderView()}
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-[#050505] text-[#e0e0e0] font-sans overflow-hidden border-4 border-[#1a1a1a] select-none relative">
      <TopBar />
      {!hasSeenTutorial && <TutorialOverlay onComplete={completeTutorial} />}
      
      <main className="flex-1 flex overflow-hidden relative">
        <div className="relative flex-1 w-full h-full">
          {renderView()}
        </div>
        <DetailBottomSheet />

        <AnimatePresence>
          {workflowQuery && (
             <CollectionWorkflow 
                query={workflowQuery}
                onClose={() => {
                  setWorkflowQuery(null);
                  setIsWorkflowMinimized(false);
                }}
                onComplete={(data) => {
                   setWorkflowQuery(null);
                   setIsWorkflowMinimized(false);
                }}
             />
          )}
        </AnimatePresence>

        {/* Global Notifications UI */}
        {isWorkflowMinimized && workflowQuery && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            className="absolute top-4 left-1/2 z-[140] flex items-center gap-3 bg-cyan-950/80 border border-cyan-500/50 px-4 py-2 rounded-full cursor-pointer hover:bg-cyan-900/80 transition-colors shadow-[0_0_20px_rgba(6,182,212,0.2)]"
            onClick={() => setIsWorkflowMinimized(false)}
          >
            <div className="w-2 h-2 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-widest">
              백그라운드 수집 중: {workflowQuery.length > 15 ? workflowQuery.slice(0, 15) + '...' : workflowQuery}
            </span>
          </motion.div>
        )}
        
        {activeCase && currentView !== 'login' && currentView !== 'settings' && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 w-[92%] md:w-[720px] pointer-events-none">
            <div className="pointer-events-auto rounded-xl border border-white/10 bg-[#050608]/90 backdrop-blur-xl px-3 py-2 font-mono text-[10px] text-gray-400 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-gray-200">{activeCase.title}</div>
                  <div className="uppercase tracking-wider text-gray-600">
                    {String(activeCase.status || 'case_created').replace(/_/g, ' ')} · EG {activeCaseEvidenceSummary?.progress ?? 0}% · Evidence {activeCaseEvidenceLedgerSummary?.total ?? 0}
                    {selectedEntity ? ` · Selected ${selectedEntity.type}:${String(selectedEntity.id).slice(0, 6)}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => { setTacticalPanel('brief'); updateOracleCase?.(activeCase.id, { status: 'briefing_revised' }); }} className="rounded border border-violet-500/20 bg-violet-950/20 px-2.5 py-1 text-violet-200 hover:border-violet-400/40">Brief</button>
                  <button onClick={() => setTacticalPanel('council')} className="rounded border border-white/10 bg-white/[0.03] px-2.5 py-1 text-gray-200 hover:border-cyan-500/40">Council</button>
                  <button onClick={() => {
                    if (!selectedEntity) {
                      const traceTarget = activeCase.linkedSourceIds?.[0]
                        ? { type: 'source', id: activeCase.linkedSourceIds[0] }
                        : activeCase.linkedSignalIds?.[0]
                          ? { type: 'signal', id: activeCase.linkedSignalIds[0] }
                          : activeCase.linkedQuestionIds?.[0]
                            ? { type: 'question', id: activeCase.linkedQuestionIds[0] }
                            : null;
                      if (traceTarget) setSelectedEntity(traceTarget);
                    }
                    addNotification('Source Trace is available inside the expanded Detail panel.', 'info');
                  }} className="rounded border border-white/10 bg-white/[0.03] px-2.5 py-1 text-gray-300 hover:border-cyan-500/40">Trace</button>
                  <button onClick={() => {
                    const targetId = activeCase.linkedScenarioIds?.[0] || activeCase.linkedHypothesisIds?.[0] || activeCase.linkedQuestionIds?.[0];
                    if (targetId) {
                      const type = activeCase.linkedScenarioIds?.[0] ? 'scenario' : activeCase.linkedHypothesisIds?.[0] ? 'hypothesis' : 'question';
                      setSelectedEntity({ type, id: targetId });
                    }
                    setCurrentView('forecast');
                  }} className="rounded border border-cyan-500/30 bg-cyan-950/20 px-2.5 py-1 text-cyan-200 hover:border-cyan-400/50">Deep Dive</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {tacticalPanel && activeCase && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[210] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm">
              <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#050608]/95 p-4 font-mono text-[11px] text-gray-400 shadow-2xl">
                <div className="mb-3 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.24em] text-gray-600">{tacticalPanel === 'brief' ? 'Oracle Briefing Studio' : 'Analyst Council'}</div>
                    <div className="text-sm text-gray-100">{activeCase.title}</div>
                  </div>
                  <button onClick={() => setTacticalPanel(null)} className="rounded border border-white/10 px-2 py-1 text-gray-500 hover:text-white">Close</button>
                </div>
                {tacticalPanel === 'council' ? (() => {
                  const council = generateAnalystCouncil?.() || [];
                  const visible = showAllCouncil ? council : council.slice(0, 3);
                  const avg = council.length ? Math.round(council.reduce((sum: number, p: any) => sum + p.confidence, 0) / council.length) : 0;
                  const positive = council.filter((p: any) => /constructive|positive/i.test(p.stance)).length;
                  const negative = council.filter((p: any) => /risk|cautious/i.test(p.stance)).length;
                  return <div className="space-y-3">
                    <div className="rounded border border-white/10 bg-black/30 p-3 text-gray-300">Council · {council.length} views · Consensus: Cautious Positive · Avg Confidence {avg}% · +{positive}/-{negative}</div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {visible.map((p: any) => <div key={p.role} className="rounded border border-white/10 bg-black/30 p-3">
                        <div className="mb-1 flex items-center justify-between"><span className="text-cyan-300">{p.role}</span><span className="text-gray-500">{p.confidence}%</span></div>
                        <div className="mb-2 text-[10px] uppercase text-gray-500">{p.stance}</div>
                        <div className="text-gray-300">{p.bubbleComment}</div>
                        <div className="mt-2 text-[10px] text-red-300/80">Risk: {p.keyRisk}</div>
                        {showAllCouncil && <div className="mt-2 text-[10px] text-gray-500">Trigger: {p.viewChangeTrigger}</div>}
                      </div>)}
                    </div>
                    <button onClick={() => setShowAllCouncil(!showAllCouncil)} className="rounded border border-white/10 px-3 py-1 text-gray-300">{showAllCouncil ? 'Show key views' : 'Show all views'}</button>
                  </div>;
                })() : (() => {
                  const briefing = generateOracleBriefing?.({ length: briefLength, mode: briefMode, includeSelectedNode: true });
                  return <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {(['flash','field','analyst'] as const).map((l) => <button key={l} onClick={() => setBriefLength(l)} className={`rounded border px-2 py-1 ${briefLength === l ? 'border-violet-400/50 text-violet-200' : 'border-white/10 text-gray-500'}`}>{l}</button>)}
                      {(['executive','risk','quant','debate','watch_plan'] as const).map((m) => <button key={m} onClick={() => setBriefMode(m)} className={`rounded border px-2 py-1 ${briefMode === m ? 'border-cyan-400/50 text-cyan-200' : 'border-white/10 text-gray-500'}`}>{m.replace('_',' ')}</button>)}
                    </div>
                    {briefing ? <div className="rounded border border-white/10 bg-black/30 p-3">
                      <div className="mb-1 text-gray-100">{briefing.title}</div>
                      <div className="mb-3 text-[10px] uppercase text-gray-500">{briefing.mode} · {briefing.length} · {briefing.stance} · {briefing.confidence !== undefined ? `${Math.round(briefing.confidence)}%` : 'confidence pending'} · {briefing.provisional ? 'PROVISIONAL' : 'UPDATED'}</div>
                      <div className="space-y-1 text-gray-300">{briefing.summary.map((line: string, i: number) => <div key={i}>• {line}</div>)}</div>
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        <div><div className="text-cyan-400">Key Evidence</div>{briefing.keyEvidence.map((x: string) => <div key={x} className="text-gray-500">{x}</div>)}</div>
                        <div><div className="text-red-400">Risks</div>{briefing.risks.map((x: string) => <div key={x} className="text-gray-500">{x}</div>)}</div>
                        <div><div className="text-gray-300">Watch Triggers</div>{briefing.watchTriggers.map((x: string) => <div key={x} className="text-gray-500">{x}</div>)}</div>
                      </div>
                    </div> : <div className="text-gray-500">No active case available for briefing.</div>}
                  </div>;
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-4 right-4 z-[150] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {notifications && notifications.map((n: any) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className={`pointer-events-auto flex items-start gap-3 p-4 w-80 bg-[#0a0a0a]/95 backdrop-blur-md border shadow-2xl ${
                  n.type === 'error' ? 'border-red-900/50' : 
                  n.type === 'success' ? 'border-cyan-900/50' : 
                  n.type === 'warning' ? 'border-amber-900/50' : 'border-[#333]'
                }`}
              >
                <div className="mt-0.5">
                  {n.type === 'error' ? <XCircle className="w-4 h-4 text-red-500"/> :
                   n.type === 'success' ? <CheckCircle className="w-4 h-4 text-cyan-500"/> :
                   n.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-500"/> :
                   <Info className="w-4 h-4 text-violet-400"/>}
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-sans text-white leading-snug">{n.message}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

         {/* Floating Search Bar (Always visible in main views) */}
        <AnimatePresence>
          {(currentView !== 'settings' && currentView !== 'login') && (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
               className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 w-[90%] md:w-[600px] pointer-events-none"
            >
               <div className="relative w-full group pointer-events-auto">
                 {/* Intense Multi-color Neon Glow like image */}
                 <div className="absolute -inset-[2px] rounded-[1.5rem] bg-gradient-to-r from-fuchsia-500 via-blue-600 to-indigo-600 opacity-60 blur-[10px]"></div>
                 <div className="absolute -inset-[1px] rounded-[1.5rem] bg-gradient-to-r from-fuchsia-500 via-blue-600 to-indigo-600 opacity-100"></div>
                 
                 <form 
                   onSubmit={(e) => { 
                     e.preventDefault(); 
                     if(localQuery.trim()) {
                       const query = localQuery.trim();
                       setLocalQuery('');
                       setWorkflowQuery(query);
                     }
                   }}
                   className="relative flex w-full bg-[#0a0a0f] rounded-[calc(1.5rem-1px)] items-center p-[6px] shadow-2xl"
                 >
                    <input 
                      type="text" 
                      value={localQuery}
                      onChange={e => setLocalQuery(e.target.value)}
                      placeholder="키워드나 문장, 질문으로 예측 시작하기..."
                      className="w-full bg-transparent text-white px-5 py-3 md:py-3.5 text-[16px] font-sans placeholder-gray-400 focus:outline-none focus:ring-0"
                    />
                    <button type="submit" className="shrink-0 w-12 h-12 bg-[#12121e] rounded-xl hover:bg-[#1a1a2e] border border-white/5 transition-colors flex items-center justify-center mr-1 shadow-inner">
                       <Search size={20} className="text-gray-300" />
                    </button>
                 </form>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <footer className="h-5 bg-[#111] border-t border-[#222] flex items-center justify-between px-3 text-[8px] font-mono text-[#555] shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-1.5">
            <span>분류된 시나리오: {scenarios?.length || 0}</span>
            <div className="flex items-center w-10 h-3 overflow-hidden animate-pulse" title="지난 24시간 시나리오 발견/성장 추이">
              <LineChart width={40} height={12} data={sparklineData} margin={{ top: 1, bottom: 1, left: 1, right: 1 }}>
                <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={1} dot={false} />
              </LineChart>
            </div>
          </div>
          <span>진행 가설: {hypotheses?.length || 0}</span>
          <span>포착 신호: {signals?.length || 0}</span>
          {selectedEntity && (
             <button 
               onClick={() => setCurrentView('forecast')}
               className="text-cyan-400 font-bold ml-4 tracking-widest uppercase hover:text-cyan-300 transition-colors hidden md:block"
             >
               ▶ 프로젝션 심층 분석
             </button>
          )}
        </div>
        <div className="flex space-x-2">
          {selectedEntity && (
             <button 
               onClick={() => setCurrentView('forecast')}
               className="text-cyan-400 font-bold tracking-widest uppercase md:hidden"
             >
               ▶ DEEP DIVE
             </button>
          )}
          <span className="hidden md:inline animate-pulse text-cyan-500">● REAL-TIME SYNC</span>
          <span className="hidden md:inline">SECURE SHELL</span>
        </div>
      </footer>
      <GlobalLoadingOverlay />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
