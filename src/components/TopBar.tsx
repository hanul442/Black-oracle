import React from 'react';
import { LogOut, Radar, Settings } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, useAppContext } from '../store';

const viewLabel: Record<string, string> = {
  command: 'Monitor',
  operations: 'Monitor',
  cases: 'Positions',
  watchlist: 'Position Detail',
  ledger: 'Audit',
  'hypothesis-summary': 'Audit Detail',
  lab: 'Lab',
  forecast: 'Scenario Detail',
  council: 'Council Detail',
  'oracle-field': 'Advanced Intelligence',
  'oracle-feed': 'Advanced Intelligence',
  settings: 'Settings',
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
      if (data.success) {
        addNotification(`Evidence collection synchronized across ${data.sourcesAnalyzed || 0} sources.`, 'success');
      } else {
        addNotification(data.error || 'Evidence synchronization failed.', 'error');
      }
    } catch {
      addNotification('Evidence synchronization failed.', 'error');
    } finally {
      setIsIngestingData(false);
    }
  };

  return (
    <header className="relative z-[70] flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#06090D]/96 px-2 backdrop-blur-xl sm:px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={() => setCurrentView('operations')} className="flex min-h-[44px] shrink-0 touch-manipulation items-center gap-2 lg:hidden">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute h-4 w-4 rounded-full border border-[#43D9E6]/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#43D9E6]" />
          </span>
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-[#E4E9ED]">Black Oracle</span>
        </button>

        <div className="hidden items-center gap-2 lg:flex">
          <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#3F4952]">Operator</span>
          <span className="text-[#2C343B]">/</span>
          <span className="text-[11px] text-[#9DA7B0]">{viewLabel[currentView] || 'Monitor'}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        <button
          onClick={handleFetchData}
          disabled={isIngestingData}
          className="flex h-11 min-w-11 touch-manipulation items-center justify-center gap-2 border border-white/[0.07] bg-white/[0.015] px-2.5 font-mono text-[7px] uppercase tracking-[0.15em] text-[#747F89] transition hover:border-[#43D9E6]/20 hover:text-[#BEC7CE] disabled:opacity-40 sm:h-8 sm:min-w-0"
          aria-label="Synchronize evidence"
        >
          <Radar className={`h-3.5 w-3.5 sm:h-3 sm:w-3 ${isIngestingData ? 'animate-spin text-[#43D9E6]' : ''}`} />
          <span className="hidden sm:inline">{isIngestingData ? 'Syncing' : 'Sync evidence'}</span>
        </button>

        <button
          onClick={() => setCurrentView('settings')}
          className={`flex h-11 w-11 touch-manipulation items-center justify-center border transition sm:h-8 sm:w-8 ${
            currentView === 'settings'
              ? 'border-[#43D9E6]/25 text-[#43D9E6]'
              : 'border-white/[0.07] text-[#606B75] hover:text-[#C7CED4]'
          }`}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>

        <button
          onClick={() => signOut(auth)}
          className="hidden h-8 w-8 items-center justify-center border border-white/[0.07] text-[#4E5862] transition hover:border-[#D66565]/20 hover:text-[#D66565] lg:flex"
          aria-label="Log out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
