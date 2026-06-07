import React from 'react';
import { Target, Activity, LayoutGrid, Settings, GitBranch, LineChart } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  onChangeView: (view: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: 'watchlist', icon: Activity, label: 'ANALYSIS' },
    { id: 'forecast', icon: LineChart, label: 'PROJECTION' },
    { id: 'settings', icon: Settings, label: 'SETTINGS' },
  ];

  return (
    <nav className="lg:hidden h-16 bg-[#030612]/90 backdrop-blur-2xl border-t border-cyan-900/40 px-4 pb-safe flex justify-around items-center shrink-0 z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all ${
              isActive 
                ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' 
                : 'text-gray-500 hover:text-gray-400'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} strokeWidth={isActive ? 2 : 1.5} />
            <span className="text-[9px] font-mono tracking-widest leading-none mt-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
