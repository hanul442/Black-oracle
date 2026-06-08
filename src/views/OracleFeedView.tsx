import React from 'react';
import { motion } from 'motion/react';
import { useAppContext } from '../store';
import { Search, ChevronRight, Activity, TrendingUp, AlertTriangle } from 'lucide-react';

export const OracleFeedView: React.FC = () => {
  const { setCurrentView, setSelectedEntity, createOracleCase, startEvidenceGatheringForCase, addNotification } = useAppContext() as any;

  // Mock initial data based on Architect guidelines
  const mockFeed = [
    {
      id: 'target_ai_semiconductor',
      name: 'AI Semiconductor Sector',
      type: 'sector',
      signalSummary: 'Momentum strong · Valuation elevated',
      valuation: 42,
      momentum: 81,
      flow: 76,
      risk: 68,
      confidence: 61,
      sources: 18,
      status: 'Cautious Positive',
      statusColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30'
    },
    {
      id: 'target_us_long_bonds',
      name: 'US Long-Term Bonds',
      type: 'macro',
      signalSummary: 'Yields stabilizing · Policy shift expected',
      valuation: 75,
      momentum: 40,
      flow: 50,
      risk: 45,
      confidence: 82,
      sources: 42,
      status: 'Opportunity',
      statusColor: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30'
    },
    {
      id: 'target_palantir',
      name: 'Palantir (PLTR)',
      type: 'stock',
      signalSummary: 'Volume spike · Expectation crowding',
      valuation: 20,
      momentum: 92,
      flow: 88,
      risk: 85,
      confidence: 76,
      sources: 29,
      status: 'Overheated',
      statusColor: 'text-red-400 bg-red-400/10 border-red-400/30'
    }
  ];

  return (
    <div className="flex flex-col w-full h-full bg-[#050505] p-4 pt-16 overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto space-y-6 pb-32">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-100 tracking-tight">Oracle Feed</h1>
            <p className="text-xs text-gray-500 font-mono mt-1">Market Intelligence / Top Targets</p>
          </div>
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
            <Search className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {mockFeed.map((item, idx) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={async () => {
                try {
                  const caseType = item.type === 'sector' ? 'sector_analysis' : item.type === 'macro' ? 'macro_analysis' : 'asset_analysis';
                  const oracleCase = await createOracleCase({
                    title: item.name,
                    query: `${item.name}: ${item.signalSummary}`,
                    caseType,
                    confidence: item.confidence,
                    summary: item.signalSummary,
                  });
                  await startEvidenceGatheringForCase(oracleCase.id);
                  addNotification?.(`Oracle Case opened from feed: ${item.name}`, 'success');
                } catch (error) {
                  console.warn('Feed case creation failed', error);
                  addNotification?.('Feed case could not be created. Opening graph view instead.', 'warning');
                }
                setSelectedEntity(null);
                setCurrentView('watchlist'); // Go to intelligence map
              }}
              className="bg-[#0f0f13] border border-white/10 rounded-2xl p-4 cursor-pointer hover:border-cyan-500/50 hover:bg-[#15151a] transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-gray-500 uppercase px-1.5 py-0.5 rounded bg-white/5">{item.type}</span>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${item.statusColor}`}>
                      {item.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-100">{item.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">{item.signalSummary}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-light text-white">{item.confidence}<span className="text-sm text-gray-500">%</span></div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">CONFIDENCE</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-gray-500">Valuation</span>
                  <span className={`text-sm font-bold ${item.valuation < 30 ? 'text-red-400' : item.valuation > 70 ? 'text-cyan-400' : 'text-gray-300'}`}>{item.valuation}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-gray-500">Momentum</span>
                  <span className={`text-sm font-bold ${item.momentum > 80 ? 'text-red-400' : 'text-gray-300'}`}>{item.momentum}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-gray-500">Flow</span>
                  <span className="text-sm font-bold text-gray-300">{item.flow}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-gray-500">Risk</span>
                  <span className={`text-sm font-bold ${item.risk > 70 ? 'text-red-400' : 'text-gray-300'}`}>{item.risk}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
