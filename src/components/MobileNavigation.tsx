import React from 'react';
import { Activity, FlaskConical, ScrollText, WalletCards } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';

const items = [
  { id: 'operations', label: 'MONITOR', icon: Activity },
  { id: 'cases', label: 'POSITIONS', icon: WalletCards },
  { id: 'ledger', label: 'AUDIT', icon: ScrollText },
  { id: 'lab', label: 'LAB', icon: FlaskConical },
];

export const MobileNavigation: React.FC = () => {
  const { currentView, setCurrentView } = useAppContext() as any;

  const isActive = (id: string) => {
    if (id === 'operations') return currentView === 'operations' || currentView === 'command';
    if (id === 'cases') return currentView === 'cases' || currentView === 'watchlist';
    if (id === 'ledger') return currentView === 'ledger' || currentView === 'hypothesis-summary';
    return currentView === id;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[85] border-t border-white/[0.07] bg-[#05070A]/96 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-2xl lg:hidden">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const active = isActive(item.id);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className="relative flex min-h-[50px] touch-manipulation flex-col items-center justify-center gap-1"
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="oracle-mobile-nav-active"
                  className="absolute top-0 h-px w-9 bg-[#43D9E6]"
                />
              )}
              <Icon className={`h-[18px] w-[18px] transition-colors ${active ? 'text-[#DCE2E8]' : 'text-[#515B65]'}`} />
              <span className={`font-mono text-[6.5px] tracking-[0.07em] transition-colors ${active ? 'text-[#AEB7C0]' : 'text-[#56616B]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
