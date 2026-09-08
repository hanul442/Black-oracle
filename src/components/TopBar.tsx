import React from 'react';
import { LogOut, RefreshCw, Settings } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, useAppContext } from '../store';
import { PaperReadinessGrade } from './PaperReadinessGrade';

const viewLabel: Record<string, string> = {
  command: 'MONITOR',
  operations: 'MONITOR',
  cases: 'POSITIONS',
  watchlist: 'POSITIONS',
  forecast: 'POSITIONS / SCENARIO',
  council: 'POSITIONS / COUNCIL',
  ledger: 'AUDIT',
  'hypothesis-summary': 'AUDIT',
  lab: 'LAB',
  settings: 'SETTINGS',
};

export const TopBar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    isIngestingData,
    setIsIngestingData,
    addNotification,
    coreInterests,
  } = useAppContext() as any;

  const handleFetchData = async () => {
    setIsIngestingData(true);
    try {
      const response = await fetch('/api/fetch-rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: auth.currentUser?.uid, coreInterests }),
      });
      const data = await response.json();
      if (data.success) addNotification(`Evidence sync complete: ${data.sourcesAnalyzed || 0} sources.`, 'success');
      else addNotification(data.error || 'Evidence synchronization failed.', 'error');
    } catch {
      addNotification('Evidence synchronization failed.', 'error');
    } finally {
      setIsIngestingData(false);
    }
  };

  return (
    <header className="relative z-[70] flex h-8 shrink-0 items-center border-b border-[#202429] bg-[#070809] px-2 font-mono">
      <button onClick={() => setCurrentView('operations')} className="mr-3 flex items-center gap-2 lg:hidden">
        <span className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#f3a312]">BO</span>
      </button>
      <span className="text-[6px] uppercase tracking-[0.08em] text-[#566069]">WORKSPACE</span>
      <span className="mx-2 text-[#2d3338]">/</span>
      <span className="text-[7px] uppercase tracking-[0.08em] text-[#b9c0c6]">{viewLabel[currentView] || 'MONITOR'}</span>
      <span className="mx-3 hidden text-[#2d3338] sm:inline">|</span>
      <span className="hidden text-[6px] uppercase tracking-[0.08em] text-[#4f585f] sm:inline">PERSISTED DATA ONLY</span>
      <PaperReadinessGrade />

      <div className="ml-auto flex h-full items-center gap-px border-l border-[#202429]">
        <button
          onClick={handleFetchData}
          disabled={isIngestingData}
          className="flex h-full items-center gap-1.5 border-r border-[#202429] px-2.5 text-[6px] uppercase tracking-[0.08em] text-[#727c84] hover:bg-[#0c0d0f] hover:text-[#f3a312] disabled:opacity-40"
          aria-label="Synchronize evidence"
        >
          <RefreshCw className={`h-3 w-3 ${isIngestingData ? 'animate-spin text-[#f3a312]' : ''}`} />
          <span className="hidden sm:inline">{isIngestingData ? 'SYNCING' : 'SYNC EVIDENCE'}</span>
        </button>
        <button
          onClick={() => setCurrentView('settings')}
          className={`flex h-full w-8 items-center justify-center border-r border-[#202429] ${currentView === 'settings' ? 'text-[#f3a312]' : 'text-[#626c74] hover:text-[#c0c7cc]'}`}
          aria-label="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => signOut(auth)} className="hidden h-full w-8 items-center justify-center text-[#555f67] hover:text-[#ff6262] lg:flex" aria-label="Log out">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
