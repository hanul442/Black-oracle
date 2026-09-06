import type { MultiCycleSnapshot, TradeMapSnapshot } from './types';

export interface PaperEntryAuditSnapshot {
  timestamp: number;
  eventScore: number | null;
  regime: string;
  regimeConfidence: number;
  structure: null | {
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    eventType: 'BOS' | 'CHOCH' | null;
    eventDirection: 'BULLISH' | 'BEARISH' | null;
    location: 'PREMIUM' | 'EQUILIBRIUM' | 'DISCOUNT';
    percentile: number;
  };
  cycle: MultiCycleSnapshot | null;
  technicalEvidence: null | {
    rawSignalCount: number;
    independentFamilyCount: number;
    correlatedSignalPenalty: number;
    directionalScore: number;
    confidence: number;
    bullishFamilies: number;
    bearishFamilies: number;
    neutralFamilies: number;
  };
  tradeMap: TradeMapSnapshot;
}

export interface ClosedPaperTrade {
  id: string;
  market: string;
  openedAt: number;
  closedAt: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
  returnPct: number;
  exitReason: string;
  strategyVersion: string;
  entryOracleTradeScore: number;
  exitOracleTradeScore: number;
  entryAudit?: PaperEntryAuditSnapshot;
}

export interface PerformanceBucket {
  label: string;
  minScore: number;
  maxScore: number;
  trades: number;
  wins: number;
  winRate: number;
  avgReturnPct: number;
  netPnl: number;
}

export interface PaperPerformanceSnapshot {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  payoffRatio: number | null;
  profitFactor: number | null;
  avgReturnPct: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  buckets: PerformanceBucket[];
}

const bucketDefinitions = [
  { label: '50-59', minScore: 50, maxScore: 59 },
  { label: '60-69', minScore: 60, maxScore: 69 },
  { label: '70-79', minScore: 70, maxScore: 79 },
  { label: '80-89', minScore: 80, maxScore: 89 },
  { label: '90-100', minScore: 90, maxScore: 100 },
];

const safeAverage = (values: number[]) => values.length > 0
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;

export const calculateMaxDrawdown = (equityCurve: Array<{ timestamp: number; equity: number }>) => {
  let peak = 0;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
  }
  return maxDrawdown;
};

export const buildPaperPerformance = (
  trades: ClosedPaperTrade[],
  equityCurve: Array<{ timestamp: number; equity: number }>,
  initialEquity: number,
  currentEquity: number,
  currentDrawdownPct: number,
): PaperPerformanceSnapshot => {
  const wins = trades.filter((trade) => trade.netPnl > 1e-9);
  const losses = trades.filter((trade) => trade.netPnl < -1e-9);
  const breakeven = trades.length - wins.length - losses.length;
  const grossProfit = wins.reduce((sum, trade) => sum + trade.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0));
  const netPnl = trades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const avgWin = safeAverage(wins.map((trade) => trade.netPnl));
  const avgLoss = Math.abs(safeAverage(losses.map((trade) => trade.netPnl)));

  const buckets = bucketDefinitions.map((definition) => {
    const bucketTrades = trades.filter((trade) =>
      trade.entryOracleTradeScore >= definition.minScore && trade.entryOracleTradeScore <= definition.maxScore,
    );
    const bucketWins = bucketTrades.filter((trade) => trade.netPnl > 0);
    return {
      ...definition,
      trades: bucketTrades.length,
      wins: bucketWins.length,
      winRate: bucketTrades.length > 0 ? bucketWins.length / bucketTrades.length : 0,
      avgReturnPct: safeAverage(bucketTrades.map((trade) => trade.returnPct)),
      netPnl: bucketTrades.reduce((sum, trade) => sum + trade.netPnl, 0),
    };
  });

  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    winRate: trades.length > 0 ? wins.length / trades.length : 0,
    grossProfit,
    grossLoss,
    netPnl,
    expectancy: trades.length > 0 ? netPnl / trades.length : 0,
    avgWin,
    avgLoss,
    payoffRatio: avgLoss > 0 ? avgWin / avgLoss : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    avgReturnPct: safeAverage(trades.map((trade) => trade.returnPct)),
    totalReturnPct: initialEquity > 0 ? (currentEquity - initialEquity) / initialEquity : 0,
    maxDrawdownPct: calculateMaxDrawdown(equityCurve),
    currentDrawdownPct,
    buckets,
  };
};
