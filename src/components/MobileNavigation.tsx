import React from 'react';
import { BookOpen, BrainCircuit, GitBranch, Orbit, ScanLine } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';

const items = [
  { id: 'oracle-field', label: 'FIELD', icon: ScanLine },
  { id: 'cases', label: 'CASES', icon: BookOpen },
  { id: 'forecast', label: 'FORECAST', icon: Orbit },
  { id: 'council', label: 'COUNCIL', icon: BrainCircuit },
  { id: 'ledger', label: 'LEDGER', icon: GitBranch },
];

export const MobileNavigation: React.FC = () => {
  const { currentView, setCurrentView } = useAppContext() as any;

  const isActive = (id: string) => {
    if (id === 'cases') return currentView === 'cases' || currentView === 'watchlist';
    if (id === 'council') return currentView === 'council' || currentView === 'hypothesis-summary';
    if (id === 'oracle-field') return currentView === 'oracle-field' || currentView === 'oracle-feed';
    return currentView === id;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[85] border-t border-white/[0.07] bg-[#05070A]/96 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-5">
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
                  className="absolute top-0 h-px w-8 bg-[#43D9E6]"
                />
              )}
              <Icon className={`h-4 w-4 transition-colors ${active ? 'text-[#DCE2E8]' : 'text-[#515B65]'}`} />
              <span className={`font-mono text-[7px] tracking-[0.12em] transition-colors ${active ? 'text-[#AEB7C0]' : 'text-[#46505A]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
