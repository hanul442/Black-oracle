import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Database, LogOut, Radar, Settings } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, useAppContext } from '../store';

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

  const navItems = [
    { id: 'command', label: 'COMMAND' },
    { id: 'cases', label: 'CASES' },
    { id: 'forecast', label: 'FORECASTS' },
    { id: 'council', label: 'COUNCIL' },
    { id: 'ledger', label: 'LEDGER' },
  ];

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
    <header className="relative z-[70] flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#05070A]/94 px-3 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 items-center gap-4 md:gap-8">
        <button onClick={() => setCurrentView('command')} className="flex shrink-0 items-center gap-2.5">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute h-4 w-4 rounded-full border border-[#43D9E6]/30" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#43D9E6] shadow-[0_0_10px_rgba(67,217,230,0.55)]" />
          </span>
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.21em] text-[#E9EDF1] sm:text-[10px] md:text-[11px] md:tracking-[0.24em]">
            Black Oracle
          </span>
        </button>

        <nav className="hidden items-center lg:flex">
          {navItems.map((item) => {
            const active = currentView === item.id ||
              (item.id === 'command' && currentView === 'watchlist') ||
              (item.id === 'council' && currentView === 'hypothesis-summary');
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`relative px-3 py-4 font-mono text-[9px] tracking-[0.2em] transition-colors ${
                  active ? 'text-[#E9EDF1]' : 'text-[#59636D] hover:text-[#AEB7C0]'
                }`}
              >
                {item.label}
                {active && (
                  <motion.span layoutId="oracle-nav-active" className="absolute bottom-0 left-3 right-3 h-px bg-[#43D9E6]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1.5 md:gap-3">
        <button
          onClick={handleFetchData}
          disabled={isIngestingData}
          className="flex h-9 items-center gap-2 border border-white/[0.08] bg-white/[0.02] px-2.5 font-mono text-[8px] uppercase tracking-[0.16em] text-[#87919B] transition hover:border-[#43D9E6]/25 hover:text-[#DCE2E8] disabled:opacity-40 sm:px-3"
          aria-label="Synchronize field"
        >
          <Radar className={`h-3.5 w-3.5 ${isIngestingData ? 'animate-spin text-[#43D9E6]' : ''}`} />
          <span className="hidden sm:inline">{isIngestingData ? 'Syncing' : 'Sync'}</span>
        </button>

        <div className="relative hidden sm:block">
          <button
            onClick={() => setShowFeeds((value) => !value)}
            className="flex h-9 items-center gap-2 border border-white/[0.08] bg-white/[0.02] px-3 font-mono text-[8px] uppercase tracking-[0.16em] text-[#87919B] transition hover:text-[#DCE2E8]"
          >
            <Database className="h-3.5 w-3.5" />
            {activeFeeds?.length || 0}
          </button>

          <AnimatePresence>
            {showFeeds && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 top-11 w-[300px] border border-white/[0.08] bg-[#090D12]/98 p-2 shadow-2xl backdrop-blur-2xl"
              >
                <div className="border-b border-white/[0.06] px-2 py-2 font-mono text-[8px] uppercase tracking-[0.2em] text-[#77818C]">
                  Active sources
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {(activeFeeds || []).map((feed: any) => (
                    <div key={feed.name} className="border-b border-white/[0.04] px-2 py-2.5 last:border-0">
                      <div className="text-[11px] text-[#D5DBE1]">{feed.name}</div>
                      <div className="mt-1 truncate font-mono text-[8px] text-[#59636D]">{feed.type}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setCurrentView('settings')}
          className={`flex h-9 w-9 items-center justify-center border transition ${
            currentView === 'settings'
              ? 'border-[#43D9E6]/30 text-[#43D9E6]'
              : 'border-white/[0.08] text-[#68727C] hover:text-[#DCE2E8]'
          }`}
          aria-label="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => signOut(auth)}
          className="hidden h-9 w-9 items-center justify-center border border-white/[0.08] text-[#59636D] transition hover:border-[#D66565]/25 hover:text-[#D66565] md:flex"
          aria-label="Log out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
