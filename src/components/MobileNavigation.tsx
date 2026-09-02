import React from 'react';
import { Activity, BookOpen, BrainCircuit, GitBranch, Orbit, PanelsTopLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';

const items = [
  { id: 'command', label: 'CMD', icon: PanelsTopLeft },
  { id: 'operations', label: 'OPS', icon: Activity },
  { id: 'cases', label: 'CASES', icon: BookOpen },
  { id: 'forecast', label: 'FCST', icon: Orbit },
  { id: 'council', label: 'CNCL', icon: BrainCircuit },
  { id: 'ledger', label: 'LEDGER', icon: GitBranch },
];

export const MobileNavigation: React.FC = () => {
  const { currentView, setCurrentView } = useAppContext() as any;

  const isActive = (id: string) => {
    if (id === 'command') return currentView === 'command' || currentView === 'watchlist';
    if (id === 'council') return currentView === 'council' || currentView === 'hypothesis-summary';
    return currentView === id;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[85] border-t border-white/[0.07] bg-[#05070A]/96 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-6">
        {items.map((item) => {
          const active = isActive(item.id);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className="relative flex min-h-[48px] flex-col items-center justify-center gap-1"
              aria-label={item.label}
            >
              {active && (
                <motion.span
                  layoutId="oracle-mobile-nav-active"
                  className="absolute top-0 h-px w-7 bg-[#43D9E6]"
                />
              )}
              <Icon className={`h-4 w-4 transition-colors ${active ? 'text-[#DCE2E8]' : 'text-[#515B65]'}`} />
              <span className={`font-mono text-[6px] tracking-[0.1em] transition-colors ${active ? 'text-[#AEB7C0]' : 'text-[#46505A]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
