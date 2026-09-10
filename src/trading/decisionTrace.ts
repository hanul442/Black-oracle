import { buildShadowCouncil, type CouncilSnapshot } from './council';
import { buildShadowArbiterRecommendation, type ShadowArbiterSnapshot } from './councilArbiter';
import type { EvidenceAggregate } from './evidence';
import { buildEvidenceForecast, type EvidenceForecast } from './evidenceForecast';
import type { MicrostructureSnapshot } from './microstructure';
import type { MicrostructureChallengerSnapshot } from './microstructureChallenger';
import type { PreTradeShadowReview } from './preTradeReview';
import { buildStrategyRouterDecision, type StrategyRouterDecision } from './strategyRouter';
import type {
  ExecutionDecision,
  LiquiditySnapshot,
  MarketRegime,
  MultiCycleSnapshot,
  MultiTimeframeSnapshot,
  PaperPortfolioSnapshot,
  RiskDisposition,
  TradeMapSnapshot,
} from './types';

export type DecisionTraceAction = 'ENTER' | 'EXIT' | 'HOLD' | 'NO_TRADE';

export interface DecisionTrace {
  timestamp: number;
  market: string;
  action: DecisionTraceAction;
  regime: MarketRegime;
  regimeConfidence: number;
  oracleTradeScore: number;
  confidence: number;
  strategyDisposition: StrategyRouterDecision['route'];
  router: StrategyRouterDecision;
  council: CouncilSnapshot;
  arbiter: ShadowArbiterSnapshot;
  preTradeReview: PreTradeShadowReview | null;
  riskDisposition: RiskDisposition;
  eventScore: number | null;
  forecast: EvidenceForecast;
  evidenceActiveCount: number;
  evidenceContradictionCount: number;
  evidenceIds: string[];
  liquidity: null | {
    tradePrice: number;
    accTradePrice24h: number;
    signedChangeRate: number;
    spreadBps: number;
    top5BidDepthKrw: number;
    top5AskDepthKrw: number;
    orderbookImbalance: number;
    score: number;
    eligible: boolean;
    warning: boolean;
    marketDataTimestamp: number | null;
  };
  portfolioRisk: null | {
    initialEquity: number;
    cash: number;
    equity: number;
    marketValue: number;
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
    feesPaid: number;
    drawdownPct: number;
    dailyPnlPct: number;
    openPositionCount: number;
    grossExposurePct: number | null;
  };
  positionSizing: {
    mode: ExecutionDecision['positionSizingMode'] | null;
    requestedNotional: number;
    requestedQuantity: number;
    expectedLossAtStop: number | null;
    stopLossPrice: number | null;
    takeProfit1Price: number | null;
    takeProfit2Price: number | null;
    takeProfit1Fraction: number | null;
    protectionBasis: ExecutionDecision['protectionBasis'] | null;
  };
  executionCosts: null;
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
  structure: null | {
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    eventType: 'BOS' | 'CHOCH' | null;
    eventDirection: 'BULLISH' | 'BEARISH' | null;
    location: 'PREMIUM' | 'EQUILIBRIUM' | 'DISCOUNT';
    percentile: number;
    liquiditySweep: 'BULLISH' | 'BEARISH' | null;
  };
  cycle: MultiCycleSnapshot | null;
  microstructure: null | {
    available: boolean;
    sampleTrades: number;
    sampleCoverageMs: number | null;
    takerImbalance: number | null;
    orderbookImbalanceTop5: number | null;
    orderbookImbalanceTop15: number | null;
    orderbookImbalanceTop30: number | null;
    pressureScore: number | null;
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNAVAILABLE';
    confidence: number;
    pointOfControl: number | null;
    valueAreaLow: number | null;
    valueAreaHigh: number | null;
    profileLocation: 'ABOVE_VALUE' | 'IN_VALUE' | 'BELOW_VALUE' | 'AT_POC' | 'UNAVAILABLE';
  };
  challenger: MicrostructureChallengerSnapshot | null;
  tradeMap: TradeMapSnapshot | null;
  primaryReason: string;
  reasons: string[];
  riskReasons: string[];
}

export interface DecisionTraceInput {
  timestamp?: number;
  market: string;
  decision: ExecutionDecision;
  multiTimeframe: MultiTimeframeSnapshot;
  evidence: EvidenceAggregate;
  liquidity?: LiquiditySnapshot | null;
  portfolioRisk?: PaperPortfolioSnapshot | null;
  microstructure?: MicrostructureSnapshot | null;
  challenger?: MicrostructureChallengerSnapshot | null;
  tradeMap?: TradeMapSnapshot | null;
  preTradeReview?: PreTradeShadowReview | null;
  hasOpenPositionAfterStep: boolean;
}

export const classifyDecisionTraceAction = (
  executionAction: ExecutionDecision['action'],
  hasOpenPositionAfterStep: boolean,
): DecisionTraceAction => {
  if (executionAction === 'ENTER' || executionAction === 'EXIT') return executionAction;
  return hasOpenPositionAfterStep ? 'HOLD' : 'NO_TRADE';
};

const clonePreTradeReview = (review: PreTradeShadowReview | null): PreTradeShadowReview | null => review ? {
  ...review,
  forecast: { ...review.forecast, reasons: review.forecast.reasons.slice() },
  router: { ...review.router, reasons: review.router.reasons.slice() },
  council: {
    ...review.council,
    members: review.council.members.map((member) => ({ ...member, reasons: member.reasons.slice() })),
  },
  arbiter: { ...review.arbiter, reasons: review.arbiter.reasons.slice() },
} : null;

export const buildDecisionTrace = (input: DecisionTraceInput): DecisionTrace => {
  const { decision, multiTimeframe, evidence } = input;
  const action = classifyDecisionTraceAction(decision.action, input.hasOpenPositionAfterStep);
  const oneHour = multiTimeframe.frames.oneHour;
  const oneHourRegime = oneHour.regime;
  const primaryReason = decision.reasons[0] ?? 'No explicit decision reason was recorded.';
  const preTradeReview = input.preTradeReview ?? null;
  const forecast = preTradeReview?.forecast ?? buildEvidenceForecast(evidence);
  const router = preTradeReview?.router ?? buildStrategyRouterDecision(multiTimeframe, forecast);
  const technical = oneHour.technicalEvidence;
  const structure = oneHour.structure;
  const micro = input.microstructure;
  const council = preTradeReview?.council ?? buildShadowCouncil({
    market: input.market.toUpperCase(),
    decision,
    multiTimeframe,
    evidence,
    microstructure: micro,
  });
  const arbiter = preTradeReview?.arbiter ?? buildShadowArbiterRecommendation({
    action,
    council,
    cycle: multiTimeframe.cycle ?? null,
    challenger: input.challenger ?? null,
  });
  const portfolio = input.portfolioRisk ?? null;
  const grossExposurePct = portfolio && portfolio.equity > 0
    ? portfolio.marketValue / portfolio.equity
    : null;

  return {
    timestamp: input.timestamp ?? Date.now(),
    market: input.market.toUpperCase(),
    action,
    regime: oneHourRegime.regime,
    regimeConfidence: oneHourRegime.confidence,
    oracleTradeScore: multiTimeframe.oracleTradeScore,
    confidence: decision.confidence,
    strategyDisposition: router.route,
    router,
    council,
    arbiter,
    preTradeReview: clonePreTradeReview(preTradeReview),
    riskDisposition: decision.riskDisposition,
    eventScore: evidence.activeCount > 0 ? evidence.score : null,
    forecast,
    evidenceActiveCount: evidence.activeCount,
    evidenceContradictionCount: evidence.contradictionCount,
    evidenceIds: evidence.evidenceIds.slice(),
    liquidity: input.liquidity ? {
      tradePrice: input.liquidity.tradePrice,
      accTradePrice24h: input.liquidity.accTradePrice24h,
      signedChangeRate: input.liquidity.signedChangeRate,
      spreadBps: input.liquidity.spreadBps,
      top5BidDepthKrw: input.liquidity.top5BidDepthKrw,
      top5AskDepthKrw: input.liquidity.top5AskDepthKrw,
      orderbookImbalance: input.liquidity.orderbookImbalance,
      score: input.liquidity.score,
      eligible: input.liquidity.eligible,
      warning: input.liquidity.warning,
      marketDataTimestamp: input.liquidity.marketDataTimestamp ?? null,
    } : null,
    portfolioRisk: portfolio ? {
      initialEquity: portfolio.initialEquity,
      cash: portfolio.cash,
      equity: portfolio.equity,
      marketValue: portfolio.marketValue,
      realizedPnl: portfolio.realizedPnl,
      unrealizedPnl: portfolio.unrealizedPnl,
      totalPnl: portfolio.totalPnl,
      feesPaid: portfolio.feesPaid,
      drawdownPct: portfolio.drawdownPct,
      dailyPnlPct: portfolio.dailyPnlPct,
      openPositionCount: portfolio.positions.length,
      grossExposurePct,
    } : null,
    positionSizing: {
      mode: decision.positionSizingMode ?? null,
      requestedNotional: decision.notional,
      requestedQuantity: decision.quantity,
      expectedLossAtStop: decision.expectedLossAtStop ?? null,
      stopLossPrice: decision.stopLossPrice,
      takeProfit1Price: decision.takeProfit1Price ?? null,
      takeProfit2Price: decision.takeProfit2Price ?? decision.takeProfitPrice,
      takeProfit1Fraction: decision.takeProfit1Fraction ?? null,
      protectionBasis: decision.protectionBasis ?? null,
    },
    // Planned fee/slippage arithmetic is not currently exposed by ExecutionDecision.
    // Keep it explicitly unavailable rather than duplicating broker constants here.
    executionCosts: null,
    technicalEvidence: technical ? {
      rawSignalCount: technical.rawSignalCount,
      independentFamilyCount: technical.independentFamilyCount,
      correlatedSignalPenalty: technical.correlatedSignalPenalty,
      directionalScore: technical.directionalScore,
      confidence: technical.confidence,
      bullishFamilies: technical.bullishFamilies,
      bearishFamilies: technical.bearishFamilies,
      neutralFamilies: technical.neutralFamilies,
    } : null,
    structure: structure ? {
      bias: structure.bias,
      confidence: structure.confidence,
      eventType: structure.lastEvent?.type ?? null,
      eventDirection: structure.lastEvent?.direction ?? null,
      location: structure.location.zone,
      percentile: structure.location.percentile,
      liquiditySweep: structure.liquiditySweep?.direction ?? null,
    } : null,
    cycle: multiTimeframe.cycle ? {
      ...multiTimeframe.cycle,
      frames: { ...multiTimeframe.cycle.frames },
      reasons: multiTimeframe.cycle.reasons.slice(),
    } : null,
    microstructure: micro ? {
      available: micro.available,
      sampleTrades: micro.sampleTrades,
      sampleCoverageMs: micro.sampleCoverageMs,
      takerImbalance: micro.takerImbalance,
      orderbookImbalanceTop5: micro.orderbookImbalanceTop5,
      orderbookImbalanceTop15: micro.orderbookImbalanceTop15,
      orderbookImbalanceTop30: micro.orderbookImbalanceTop30,
      pressureScore: micro.pressureScore,
      direction: micro.direction,
      confidence: micro.confidence,
      pointOfControl: micro.profile.pointOfControl,
      valueAreaLow: micro.profile.valueAreaLow,
      valueAreaHigh: micro.profile.valueAreaHigh,
      profileLocation: micro.profile.currentLocation,
    } : null,
    challenger: input.challenger ? { ...input.challenger, reasons: input.challenger.reasons.slice() } : null,
    tradeMap: input.tradeMap ? { ...input.tradeMap, reasons: input.tradeMap.reasons.slice() } : null,
    primaryReason,
    reasons: decision.reasons.slice(),
    riskReasons: decision.riskReasons.slice(),
  };
};
