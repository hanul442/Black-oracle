import React, { useState, useEffect } from 'react';
import { useAppContext, auth } from '../store';
import { Activity, Clock, Database, DownloadCloud, Radio, Radar, ChevronDown, LogOut, Search, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';

export const TopBar: React.FC = () => {
  const { cycleStage, setCycleIndex, sources, signals, questions, hypotheses, scenarios, isIngestingData, setIsIngestingData, addNotification, activeFeeds, coreInterests, reports, currentView, setCurrentView, setWorkflowQuery, mergedNodesCount, activeCase, activeCaseEvidenceSummary } = useAppContext();
  const [showFeeds, setShowFeeds] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState("");

  const matchedKeywords = React.useMemo(() => {
    if (!coreInterests || !reports || reports.length === 0) return [];
    
    const keywords = coreInterests.split(',').map(k => k.trim()).filter(Boolean);
    const matched = new Set<string>();
    const combinedText = reports.map(r => r.title + " " + r.content).join(" ").toLowerCase();
    
    for (const kw of keywords) {
      if (combinedText.includes(kw.toLowerCase())) {
        matched.add(kw);
      }
    }
    
    return Array.from(matched);
  }, [coreInterests, reports]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };

  const handleFetchData = async () => {
    setIsIngestingData(true);
    setCycleIndex(0); // COLLECTING
    
    // Simulate process stages while waiting
    const timer1 = setTimeout(() => setCycleIndex(1), 2000); // NORMALIZING
    const timer2 = setTimeout(() => setCycleIndex(6), 4000); // EXTRACTING_SIGNALS
    const timer3 = setTimeout(() => setCycleIndex(11), 7000); // SCENARIO_UPDATING

    try {
      const resp = await fetch('/api/fetch-rss', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (auth.currentUser as any)?.uid, coreInterests: coreInterests })
      });
      const data = await resp.json();
      if (data.success) {
         addNotification(`수집 완료: ${(data.sourcesAnalyzed ?? data.count ?? 0)}개 소스 분석됨`, 'success');
      } else {
         addNotification(`수집 실패: ${data.error}`, 'error');
      }
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsIngestingData(false);
    }
  };

  const activeCaseLinkedNodes = activeCase ? [
    ...(activeCase.linkedSourceIds || []),
    ...(activeCase.linkedSignalIds || []),
    ...(activeCase.linkedQuestionIds || []),
    ...(activeCase.linkedHypothesisIds || []),
    ...(activeCase.linkedScenarioIds || []),
    ...(activeCase.linkedReportIds || []),
  ].length : 0;

  const formatCaseStatus = (status?: string) => {
    if (!status) return 'No Active Case';
    return status.replace(/_/g, ' ');
  };

  const formattedTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }) + ' UTC';

  return (
    <header className="h-14 md:h-12 border-b border-cyan-900/30 flex items-center justify-between px-4 md:px-6 bg-[#050a1f]/80 backdrop-blur-xl z-[60] shrink-0 relative shadow-[0_0_30px_rgba(34,211,238,0.05)]">
      
      <div className="flex items-center space-x-4 md:space-x-8">
        <div className="flex items-center gap-2 group cursor-pointer border-r border-white/10 pr-4 md:pr-6">
          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/50">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <div className="absolute inset-0 rounded-full animate-ping bg-cyan-500/20" />
          </div>
          <div className="flex flex-col">
            <span className="font-display tracking-[0.15em] text-white text-xs md:text-sm font-bold uppercase group-hover:text-cyan-400 transition-colors">
              Oracle
            </span>
            <span className="text-cyan-500/70 font-mono text-[8px] tracking-widest uppercase hidden sm:block">System v4.0.2</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="hidden lg:flex space-x-1 items-center bg-black/40 p-1 rounded-lg border border-white/5">
          {[
            { id: 'watchlist', label: 'ANALYSIS' },
            { id: 'hypothesis-summary', label: 'HYPOTHESIS' },
            { id: 'forecast', label: 'PROJECTION' },
            { id: 'settings', label: 'SETTINGS' }
          ].map(view => (
            <button 
              key={view.id} 
              onClick={() => setCurrentView(view.id)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-mono tracking-widest uppercase transition-colors ${currentView === view.id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'}`}
            >
              {view.label}
            </button>
          ))}
        </div>
        
        <div className="hidden xl:flex space-x-6 text-[10px] font-mono text-gray-400 items-center pl-4 border-l border-white/10">
          <div className="flex flex-col">
            <span className="text-gray-600 text-[8px] uppercase tracking-widest leading-none mb-1">현재 상태</span>
            <span className="text-cyan-400 font-bold uppercase">{cycleStage === 'NORMALIZING' ? '데이터 정규화' : cycleStage === 'EXTRACTING_SIGNALS' ? '신호 추출' : cycleStage === 'SCENARIO_UPDATING' ? '시나리오 업데이트' : cycleStage}</span>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex flex-col border-r border-white/10 pr-6 mr-2">
            <span className="text-gray-600 text-[8px] uppercase tracking-widest leading-none mb-1">탐지 지표</span>
            <span className="text-gray-300">
              신호: <span className="text-white">{signals.length}</span> / 가설: <span className="text-white">{hypotheses.length}</span> / 시나리오: <span className="text-white">{scenarios.length}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 pr-4">
            <div className={`relative flex items-center justify-center w-4 h-4 rounded-full ${mergedNodesCount > 0 ? 'bg-amber-950 border border-amber-500/50' : 'bg-gray-900 border border-gray-700'}`}>
               <div className={`w-1.5 h-1.5 rounded-full ${mergedNodesCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-gray-600'}`} />
            </div>
            <div className="flex flex-col">
               <span className="text-gray-600 text-[8px] uppercase tracking-widest leading-none mb-1">AUTO-MERGE</span>
               <span className="text-[10px] text-gray-300"><span className={mergedNodesCount > 0 ? "text-amber-400 font-bold" : "text-gray-500"}>{mergedNodesCount}</span> nodes optimized</span>
            </div>
          </div>

          {activeCase && (
            <>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex flex-col max-w-[220px] border border-white/10 bg-black/30 px-2.5 py-1 rounded-md">
                <span className="text-gray-600 text-[8px] uppercase tracking-widest leading-none mb-1">CASE FILE</span>
                <span className="text-gray-200 text-[10px] truncate">{activeCase.title}</span>
                <span className="text-[8px] text-cyan-500 uppercase tracking-wider">
                  {formatCaseStatus(activeCase.status)} · {activeCaseLinkedNodes} nodes · EG {activeCaseEvidenceSummary?.progress ?? 0}%{activeCase.confidence ? ` · ${Math.round(activeCase.confidence)}%` : ''}
                </span>
              </div>
            </>
          )}
          {matchedKeywords.length > 0 && (
            <>
              <div className="h-6 w-px bg-white/10" />
              <div className="flex flex-col gap-1">
                <span className="text-gray-600 text-[8px] uppercase tracking-widest leading-none">주요 키워드 트렌드</span>
                <div className="flex items-center gap-2">
                  {matchedKeywords.map((kw) => (
                    <span key={kw} className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-fuchsia-500/50 bg-fuchsia-950/40 text-fuchsia-300 text-[9px] font-mono shadow-[0_0_10px_rgba(217,70,239,0.3)] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {activeCase && (
        <div className="hidden md:flex xl:hidden absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 max-w-[320px] items-center gap-2 rounded-md border border-white/10 bg-black/40 px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-gray-400">
          <span className="text-gray-600">CASE</span>
          <span className="truncate text-gray-200">{activeCase.title}</span>
          <span className="text-cyan-500">{formatCaseStatus(activeCase.status)}</span>
          <span className="text-gray-500">{activeCaseLinkedNodes} nodes · EG {activeCaseEvidenceSummary?.progress ?? 0}%</span>
        </div>
      )}

      <div className="flex items-center space-x-3 md:space-x-6">
        {/* Settings button added, Search removed */}
        <button
          onClick={() => setCurrentView(currentView === 'settings' ? 'watchlist' : 'settings')}
          className={`p-2 rounded-lg border transition-all ${currentView === 'settings' ? 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'}`}
          title="시스템 설정 (System Settings)"
        >
          <Settings className={`w-4 h-4 ${currentView === 'settings' ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
        </button>

        <button 
          onClick={handleFetchData}
          disabled={isIngestingData}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors font-mono text-[10px] ${isIngestingData ? 'border-cyan-900/50 bg-cyan-900/20 text-cyan-700' : 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/80 hover:text-cyan-100 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]'}`}
        >
          <Radar className={`w-3.5 h-3.5 ${isIngestingData ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isIngestingData ? '동기화 중...' : '데이터 동기화 (REFRESH)'}</span>
        </button>

        {/* ACTIVE FEEDS DROPDOWN */}
        <div className="relative">
          <button 
            onClick={() => setShowFeeds(!showFeeds)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-900/40 bg-indigo-950/20 hover:bg-indigo-900/40 transition-colors font-mono text-[10px] text-indigo-300"
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">활성 소스</span>
            <span className="bg-indigo-500/20 text-indigo-200 px-1.5 rounded-sm">{activeFeeds.length}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showFeeds ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showFeeds && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-12 right-0 w-[320px] bg-[#050a1f]/95 backdrop-blur-2xl border border-indigo-500/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 p-2"
              >
                <div className="text-[10px] uppercase tracking-widest font-mono text-indigo-400 font-bold px-3 py-2 border-b border-indigo-900/50 mb-2 flex justify-between">
                  <span>모니터링 데이터 소스</span>
                  <span>{activeFeeds.length} LIVE</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {activeFeeds.map(f => (
                    <div key={f.name} className="px-3 py-2 border-b border-white/5 hover:bg-white/5 flex items-center justify-between group">
                      <div className="flex flex-col">
                        <span className="text-white text-xs font-sans group-hover:text-indigo-300 transition-colors">{f.name}</span>
                        <span className="text-[9px] font-mono text-gray-500">{f.url}</span>
                      </div>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 uppercase border border-indigo-900">{f.type}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-end text-[10px] font-mono justify-center mr-3">
           <span className="text-cyan-500 tracking-widest">{formattedTime}</span>
           <span className="text-gray-500 text-[8px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> 네트워크 보안 유지됨
           </span>
        </div>
        
        <button 
          onClick={handleLogout}
          className="p-2 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all shadow-[0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
          title="로그아웃"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
