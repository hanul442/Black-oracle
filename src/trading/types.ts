export type TradingMode = 'PAPER' | 'APPROVAL_LIVE' | 'AUTO_LIVE';
export type TradeSide = 'BUY' | 'SELL';
export type SignalAction = 'BUY' | 'SELL' | 'WAIT';
export type MarketRegime = 'STRONG_UPTREND' | 'UPTREND' | 'RANGE' | 'DOWNTREND' | 'STRONG_DOWNTREND';
export type RiskDisposition = 'APPROVE' | 'REJECT' | 'NOT_EVALUATED';

export interface Candle {
  market: string;
  timeframeMinutes: number;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
}

export interface IndicatorSnapshot {
  close: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  stochRsi14: number;
  atr14: number;
  atrPct: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  roc20: number;
  bollingerMiddle: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerPercentB: number;
  bollingerBandwidth: number;
  volumeZScore: number;
}

export interface SwingPoint {
  index: number;
  timestamp: number;
  confirmedAt: number;
  price: number;
  type: 'HIGH' | 'LOW';
}

export interface MarketStructureEvent {
  type: 'BOS' | 'CHOCH';
  direction: 'BULLISH' | 'BEARISH';
  breakPrice: number;
  brokenSwingPrice: number;
  brokenSwingTimestamp: number;
  confirmedAt: number;
}

export interface MarketStructureSnapshot {
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  lastSwingHigh: SwingPoint | null;
  lastSwingLow: SwingPoint | null;
  lastEvent: MarketStructureEvent | null;
  recentEvents: MarketStructureEvent[];
  location: {
    zone: 'PREMIUM' | 'EQUILIBRIUM' | 'DISCOUNT';
    percentile: number;
    rangeLow: number;
    rangeHigh: number;
  };
  liquiditySweep: null | {
    direction: 'BULLISH' | 'BEARISH';
    sweptPrice: number;
    extremePrice: number;
    confirmedAt: number;
  };
  reasons: string[];
}

export type TechnicalEvidenceFamily = 'STRUCTURE' | 'TREND' | 'MOMENTUM' | 'LOCATION' | 'VOLUME' | 'VOLATILITY';

export interface TechnicalEvidenceItem {
  id: string;
  family: TechnicalEvidenceFamily;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  confidence: number;
  observedAt: number;
  expiresAt: number;
  sourceFields: string[];
  reason: string;
}

export interface TechnicalEvidenceSnapshot {
  items: TechnicalEvidenceItem[];
  rawSignalCount: number;
  independentFamilyCount: number;
  correlatedSignalPenalty: number;
  bullishFamilies: number;
  bearishFamilies: number;
  neutralFamilies: number;
  directionalScore: number;
  confidence: number;
  reasons: string[];
}

export interface RegimeSnapshot {
  regime: MarketRegime;
  confidence: number;
  trendStrength: number;
  highVolatility: boolean;
  reasons: string[];
}

export interface MeanReversionSignal {
  action: SignalAction;
  state: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
  score: number;
  confidence: number;
  rawExtremeScore: number;
  trendPenalty: number;
  reasons: string[];
}

export interface TrendSignal {
  action: SignalAction;
  directionalScore: number;
  strength: number;
  confidence: number;
  reasons: string[];
}

export interface MomentumSignal {
  action: SignalAction;
  directionalScore: number;
  strength: number;
  confidence: number;
  reasons: string[];
}

export interface StrategyWeightSet {
  trend: number;
  momentum: number;
  meanReversion: number;
  event: number;
}

export interface SignalFusionSnapshot {
  action: SignalAction;
  directionalScore: number;
  oracleTradeScore: number;
  confidence: number;
  positionRiskMultiplier: number;
  weights: StrategyWeightSet;
  components: {
    trend: number;
    momentum: number;
    meanReversion: number;
    event: number;
  };
  reasons: string[];
}

export interface LiquidityInput {
  market: string;
  tradePrice: number;
  accTradePrice24h: number;
  signedChangeRate: number;
  bestBid: number;
  bestAsk: number;
  top5BidDepthKrw: number;
  top5AskDepthKrw: number;
  warning: boolean;
}

export interface LiquiditySnapshot {
  market: string;
  tradePrice: number;
  accTradePrice24h: number;
  signedChangeRate: number;
  spreadBps: number;
  top5BidDepthKrw: number;
  top5AskDepthKrw: number;
  orderbookImbalance: number;
  warning: boolean;
  score: number;
  eligible: boolean;
  reasons: string[];
}

export interface RiskLimits {
  maxPositionPct: number;
  maxDailyLossPct: number;
  maxTotalDrawdownPct: number;
  maxEstimatedSlippageBps: number;
  maxMarketDataAgeMs: number;
}

export interface RiskCheckInput {
  equity: number;
  requestedNotional: number;
  dailyPnlPct: number;
  totalDrawdownPct: number;
  estimatedSlippageBps: number;
  marketDataAgeMs: number;
  feedConnected: boolean;
  ledgerInSync: boolean;
  duplicateOrderDetected: boolean;
}

export interface RiskDecision {
  status: 'PASS' | 'REJECT';
  approvedNotional: number;
  maxAllowedNotional: number;
  reasons: string[];
}

export interface PaperOrderRequest {
  id: string;
  market: string;
  side: TradeSide;
  notional?: number;
  quantity?: number;
  referencePrice: number;
  timestamp: number;
  strategyVersion: string;
}

export interface PaperFill {
  orderId: string;
  market: string;
  side: TradeSide;
  quantity: number;
  referencePrice: number;
  fillPrice: number;
  notional: number;
  fee: number;
  slippageBps: number;
  timestamp: number;
  strategyVersion: string;
}

export interface PaperPosition {
  market: string;
  quantity: number;
  averageCost: number;
  entryPrice: number;
  openedAt: number;
  updatedAt: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
}

export interface MarkedPaperPosition extends PaperPosition {
  markPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface PaperPortfolioSnapshot {
  initialEquity: number;
  cash: number;
  equity: number;
  marketValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  feesPaid: number;
  peakEquity: number;
  drawdownPct: number;
  dailyPnlPct: number;
  positions: MarkedPaperPosition[];
  equityCurve: Array<{ timestamp: number; equity: number }>;
}

export interface MultiCycleSnapshot {
  state: 'ALIGNED_BULLISH' | 'ALIGNED_BEARISH' | 'MIXED' | 'PULLBACK' | 'NEUTRAL';
  directionalScore: number;
  confidence: number;
  aligned: boolean;
  entryTiming: 'READY' | 'WAIT_PULLBACK' | 'WAIT_CONFIRMATION' | 'NO_EDGE';
  frames: {
    fourHour: number;
    oneHour: number;
    fifteenMinute: number;
  };
  reasons: string[];
}

export interface MultiTimeframeSnapshot {
  market: string;
  asOf: number;
  action: SignalAction;
  directionalScore: number;
  oracleTradeScore: number;
  confidence: number;
  aligned: boolean;
  positionRiskMultiplier: number;
  frames: {
    fourHour: TradingSnapshot;
    oneHour: TradingSnapshot;
    fifteenMinute: TradingSnapshot;
  };
  cycle?: MultiCycleSnapshot;
  reasons: string[];
}

export interface ExecutionDecision {
  action: 'ENTER' | 'EXIT' | 'HOLD';
  side: TradeSide | null;
  notional: number;
  quantity: number;
  confidence: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  riskDisposition: RiskDisposition;
  riskReasons: string[];
  reasons: string[];
}

export interface TradeMapSnapshot {
  status: 'ACTIVE' | 'CANDIDATE' | 'NO_TRADE';
  direction: 'LONG' | 'NONE';
  entryPrice: number | null;
  structuralInvalidationPrice: number | null;
  stopLossPrice: number | null;
  takeProfit1Price: number | null;
  takeProfit2Price: number | null;
  riskReward1: number | null;
  riskReward2: number | null;
  expectedRiskPct: number | null;
  reasons: string[];
}

export interface TradingLedgerEvent<T = Record<string, unknown>> {
  id: string;
  sequence: number;
  timestamp: number;
  type:
    | 'MARKET_SNAPSHOT'
    | 'SIGNAL'
    | 'RISK_PASS'
    | 'RISK_REJECT'
    | 'ORDER_SUBMITTED'
    | 'ORDER_FILLED'
    | 'POSITION_UPDATED'
    | 'SYSTEM_HALT';
  strategyVersion: string;
  payload: T;
}

export interface TradingSnapshot {
  market: string;
  timeframeMinutes: number;
  candleCount: number;
  asOf: number;
  indicators: IndicatorSnapshot;
  regime: RegimeSnapshot;
  trend: TrendSignal;
  momentum: MomentumSignal;
  meanReversion: MeanReversionSignal;
  fusion: SignalFusionSnapshot;
  structure?: MarketStructureSnapshot;
  technicalEvidence?: TechnicalEvidenceSnapshot;
}
