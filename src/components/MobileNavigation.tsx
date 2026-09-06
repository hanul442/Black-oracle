import React from 'react';
import { useAppContext } from '../store';

const items = [
  { id: 'operations', code: 'MON', label: 'MONITOR' },
  { id: 'cases', code: 'POS', label: 'POSITIONS' },
  { id: 'ledger', code: 'AUD', label: 'AUDIT' },
  { id: 'lab', code: 'LAB', label: 'LAB' },
];

export const MobileNavigation: React.FC = () => {
  const { currentView, setCurrentView } = useAppContext() as any;

  const isActive = (id: string) => {
    if (id === 'operations') return ['operations', 'command', 'oracle-field', 'oracle-feed'].includes(currentView);
    if (id === 'cases') return ['cases', 'watchlist', 'forecast', 'council'].includes(currentView);
    if (id === 'ledger') return ['ledger', 'hypothesis-summary'].includes(currentView);
    return currentView === id;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[85] border-t border-[#202429] bg-[#070809] pb-[max(env(safe-area-inset-bottom),4px)] lg:hidden">
      <div className="grid grid-cols-4 font-mono">
        {items.map((item) => {
          const active = isActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`min-h-[42px] border-r border-[#171b1f] px-1 py-1.5 text-center ${active ? 'bg-[#101113]' : 'bg-[#070809]'}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <span className={`block text-[7px] font-semibold tracking-[0.08em] ${active ? 'text-[#f3a312]' : 'text-[#78828a]'}`}>{item.code}</span>
              <span className="mt-0.5 block text-[5px] tracking-[0.06em] text-[#4f585f]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
