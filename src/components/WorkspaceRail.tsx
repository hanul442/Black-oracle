import React from 'react';
import { ChevronRight, CircleDot, LayoutDashboard, ListTree, Settings, ScrollText } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';

const primary = [
  { id: 'command', label: 'Oracle', icon: LayoutDashboard },
  { id: 'strategies', label: 'Strategies', icon: ListTree },
  { id: 'log', label: 'Log', icon: ScrollText },
];

export const WorkspaceRail: React.FC = () => {
  const { currentView, setCurrentView, activeFeeds } = useAppContext() as any;

  const isActive = (id: string) => {
    if (id === 'command') return currentView === 'command' || currentView === 'watchlist';
    return currentView === id;
  };

  return (
    <aside className="hidden w-[210px] shrink-0 border-r border-white/[0.06] bg-[#06090D] lg:flex lg:flex-col">
      <div className="border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute h-4 w-4 rounded-full border border-[#43D9E6]/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#43D9E6] shadow-[0_0_8px_rgba(67,217,230,.45)]" />
          </span>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#DDE3E8]">Black Oracle</div>
            <div className="mt-0.5 font-mono text-[6px] uppercase tracking-[0.17em] text-[#4D5862]">Autonomous decision terminal</div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-2 py-3">
        <div className="px-2.5 font-mono text-[6px] uppercase tracking-[0.2em] text-[#3F4952]">Core</div>
        <div className="mt-1 space-y-0.5">
          {primary.map((item) => {
            const active = isActive(item.id);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`group relative flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left transition ${active ? 'bg-white/[0.045] text-[#E7ECEF]' : 'text-[#69747F] hover:bg-white/[0.025] hover:text-[#BFC7CE]'}`}
              >
                {active && <motion.span layoutId="workspace-rail-active" className="absolute bottom-1 left-0 top-1 w-px bg-[#43D9E6]" />}
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[#43D9E6]' : 'text-[#4D5862] group-hover:text-[#74808B]'}`} />
                <span className="min-w-0 flex-1 text-[11px] uppercase tracking-[0.04em]">{item.label}</span>
                <ChevronRight className={`h-3 w-3 ${active ? 'text-[#65717C]' : 'text-[#303840]'}`} />
              </button>
            );
          })}
        </div>

        <div className="mt-6 border-t border-white/[0.05] px-2.5 pt-4">
          <div className="flex items-center justify-between font-mono text-[6px] uppercase tracking-[0.14em] text-[#46515B]">
            <span>Source health</span>
            <span>{activeFeeds?.length || 0} feeds</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[9px] text-[#68737D]">
            <CircleDot className="h-3 w-3 text-[#72B6A0]" />
            <span>Monitor active</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06] p-2">
        <button
          onClick={() => setCurrentView('settings')}
          className={`flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left transition ${currentView === 'settings' ? 'bg-white/[0.045] text-[#E7ECEF]' : 'text-[#69747F] hover:bg-white/[0.025] hover:text-[#BFC7CE]'}`}
        >
          <Settings className="h-3.5 w-3.5 text-[#4D5862]" />
          <span className="text-[11px]">Settings</span>
        </button>
      </div>
    </aside>
  );
};
