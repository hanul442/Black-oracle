import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Database, LogOut, Radar, Settings } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, useAppContext } from '../store';

const viewLabel: Record<string, string> = {
  command: 'Command',
  operations: 'Operations',
  cases: 'Cases',
  watchlist: 'Deep Case',
  forecast: 'Forecasts',
  council: 'Council',
  'hypothesis-summary': 'Council',
  ledger: 'Ledger',
  'oracle-field': 'Raw Field',
  'oracle-feed': 'Raw Field',
  settings: 'Settings',
};

export const TopBar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    isIngestingData,
    setIsIngestingData,
    addNotification,
    activeFeeds,
    coreInterests,
  } = useAppContext() as any;

  const [showFeeds, setShowFeeds] = useState(false);

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
        addNotification(`Field synchronized across ${data.sourcesAnalyzed || 0} sources.`, 'success');
      } else {
        addNotification(data.error || 'Field synchronization failed.', 'error');
      }
    } catch {
      addNotification('Field synchronization failed.', 'error');
    } finally {
      setIsIngestingData(false);
    }
  };

  return (
    <header className="relative z-[70] flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#06090D]/96 px-3 backdrop-blur-xl md:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={() => setCurrentView('command')} className="flex shrink-0 items-center gap-2 lg:hidden">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute h-4 w-4 rounded-full border border-[#43D9E6]/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#43D9E6]" />
          </span>
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-[#E4E9ED]">Black Oracle</span>
        </button>

        <div className="hidden items-center gap-2 lg:flex">
          <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#3F4952]">Workspace</span>
          <span className="text-[#2C343B]">/</span>
          <span className="text-[11px] text-[#9DA7B0]">{viewLabel[currentView] || 'Command'}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          onClick={handleFetchData}
          disabled={isIngestingData}
          className="flex h-8 items-center gap-2 border border-white/[0.07] bg-white/[0.015] px-2.5 font-mono text-[7px] uppercase tracking-[0.15em] text-[#747F89] transition hover:border-[#43D9E6]/20 hover:text-[#BEC7CE] disabled:opacity-40"
          aria-label="Synchronize field"
        >
          <Radar className={`h-3 w-3 ${isIngestingData ? 'animate-spin text-[#43D9E6]' : ''}`} />
          <span className="hidden sm:inline">{isIngestingData ? 'Syncing' : 'Sync'}</span>
        </button>

        <div className="relative hidden sm:block">
          <button
            onClick={() => setShowFeeds((value) => !value)}
            className="flex h-8 items-center gap-2 border border-white/[0.07] bg-white/[0.015] px-2.5 font-mono text-[7px] uppercase tracking-[0.15em] text-[#747F89] transition hover:text-[#BEC7CE]"
          >
            <Database className="h-3 w-3" />
            {activeFeeds?.length || 0}
          </button>

          <AnimatePresence>
            {showFeeds && (
              <motion.div
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 7 }}
                className="absolute right-0 top-10 w-[300px] border border-white/[0.08] bg-[#090D12]/98 p-2 shadow-2xl backdrop-blur-2xl"
              >
                <div className="border-b border-white/[0.06] px-2 py-2 font-mono text-[7px] uppercase tracking-[0.2em] text-[#59636D]">Source connections</div>
                <div className="max-h-[300px] overflow-y-auto">
                  {(activeFeeds || []).map((feed: any) => (
                    <div key={feed.name} className="border-b border-white/[0.04] px-2 py-2.5 last:border-0">
                      <div className="text-[11px] text-[#C9D0D6]">{feed.name}</div>
                      <div className="mt-1 truncate font-mono text-[7px] text-[#4E5862]">{feed.type}</div>
                    </div>
                  ))}
                  {!activeFeeds?.length && <div className="px-2 py-5 text-[10px] text-[#4E5862]">No active source metadata.</div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setCurrentView('settings')}
          className={`flex h-8 w-8 items-center justify-center border transition lg:hidden ${
            currentView === 'settings'
              ? 'border-[#43D9E6]/25 text-[#43D9E6]'
              : 'border-white/[0.07] text-[#606B75] hover:text-[#C7CED4]'
          }`}
          aria-label="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
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
