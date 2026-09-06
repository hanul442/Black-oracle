import React from 'react';
import { useAppContext } from '../store';

const primary = [
  { id: 'operations', code: 'MON', label: 'Monitor' },
  { id: 'cases', code: 'POS', label: 'Positions' },
  { id: 'ledger', code: 'AUD', label: 'Audit' },
  { id: 'lab', code: 'LAB', label: 'Lab' },
];

export const WorkspaceRail: React.FC = () => {
  const { currentView, setCurrentView } = useAppContext() as any;

  const isActive = (id: string) => {
    if (id === 'operations') return ['operations', 'command', 'oracle-field', 'oracle-feed'].includes(currentView);
    if (id === 'cases') return ['cases', 'watchlist', 'forecast', 'council'].includes(currentView);
    if (id === 'ledger') return ['ledger', 'hypothesis-summary'].includes(currentView);
    return currentView === id;
  };

  return (
    <aside className="hidden w-[148px] shrink-0 border-r border-[#202429] bg-[#050607] lg:flex lg:flex-col">
      <div className="border-b border-[#202429] px-2.5 py-2.5 font-mono">
        <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#f3a312]">BLACK ORACLE</div>
        <div className="mt-1 text-[5.5px] uppercase tracking-[0.08em] text-[#59636b]">PAPER TERMINAL</div>
      </div>

      <nav className="flex-1 py-1.5 font-mono">
        {primary.map((item, index) => {
          const active = isActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`grid w-full grid-cols-[28px_1fr] items-center border-b border-[#15191c] px-2 py-2 text-left transition ${active ? 'bg-[#101113]' : 'hover:bg-[#0a0c0e]'}`}
            >
              <span className={`text-[6px] ${active ? 'text-[#f3a312]' : 'text-[#535d65]'}`}>{index + 1}</span>
              <span>
                <span className={`block text-[7px] font-semibold tracking-[0.08em] ${active ? 'text-[#f3a312]' : 'text-[#9da6ad]'}`}>{item.code}</span>
                <span className="mt-0.5 block text-[5.5px] uppercase tracking-[0.06em] text-[#59636b]">{item.label}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#202429] font-mono">
        <button onClick={() => setCurrentView('settings')} className={`w-full px-2.5 py-2 text-left text-[6px] uppercase tracking-[0.08em] ${currentView === 'settings' ? 'bg-[#101113] text-[#f3a312]' : 'text-[#5d676f] hover:text-[#aab2b8]'}`}>SETTINGS</button>
        <div className="border-t border-[#15191c] px-2.5 py-2 text-[5px] uppercase leading-3 tracking-[0.06em] text-[#40484f]">Evidence governed<br />Human supervised<br />No live authority</div>
      </div>
    </aside>
  );
};
