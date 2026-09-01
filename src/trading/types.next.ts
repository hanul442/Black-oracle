export type TradingMode = 'PAPER' | 'APPROVAL_LIVE' | 'AUTO_LIVE';
export type TradeSide = 'BUY' | 'SELL';
export type SignalAction = 'BUY' | 'SELL' | 'WAIT';
export type MarketRegime = 'STRONG_UPTREND' | 'UPTREND' | 'RANGE' | 'DOWNTREND' | 'STRONG_DOWNTREND';

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
  notional: number;
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
}
