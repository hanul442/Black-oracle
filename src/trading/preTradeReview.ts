import { buildShadowCouncil, type CouncilSnapshot } from './council';
import { buildShadowArbiterRecommendation, type ShadowArbiterSnapshot } from './councilArbiter';
import type { EvidenceAggregate } from './evidence';
import { buildEvidenceForecast, type EvidenceForecast } from './evidenceForecast';
import type { MicrostructureSnapshot } from './microstructure';
import type { MicrostructureChallengerSnapshot } from './microstructureChallenger';
import { buildStrategyRouterDecision, type StrategyRouterDecision } from './strategyRouter';
import type {
  ExecutionDecision,
  LiquiditySnapshot,
  MultiTimeframeSnapshot,
  PaperPortfolioSnapshot,
  RiskCheckInput,
  TradeMapSnapshot,
} from './types';

export interface PreTradeShadowAuditContext {
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
  positionSizing: null | {
    mode: ExecutionDecision['positionSizingMode'] | null;
    requestedNotional: number;
    expectedLossAtStop: number | null;
    stopLossPrice: number | null;
    takeProfit1Price: number | null;
    takeProfit2Price: number | null;
    takeProfit1Fraction: number | null;
  };
  riskInput: RiskCheckInput | null;
  proposedTradeMap: TradeMapSnapshot | null;
}

export interface PreTradeShadowReview {
  stage: 'PRE_EXECUTION_SHADOW';
  executionAuthority: false;
  generatedAt: number;
  market: string;
  reviewedAction: ExecutionDecision['action'];
  forecast: EvidenceForecast;
  router: StrategyRouterDecision;
  council: CouncilSnapshot;
  arbiter: ShadowArbiterSnapshot;
  auditContext: PreTradeShadowAuditContext;
}

export interface PreTradeShadowReviewInput {
  timestamp?: number;
  market: string;
  decision: ExecutionDecision;
  multiTimeframe: MultiTimeframeSnapshot;
  evidence: EvidenceAggregate;
  microstructure?: MicrostructureSnapshot | null;
  challenger?: MicrostructureChallengerSnapshot | null;
  liquidity?: LiquiditySnapshot | null;
  portfolio?: PaperPortfolioSnapshot | null;
  riskInput?: RiskCheckInput | null;
  proposedTradeMap?: TradeMapSnapshot | null;
}

const snapshotAuditContext = (input: PreTradeShadowReviewInput): PreTradeShadowAuditContext => {
  const liquidity = input.liquidity ? {
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
    marketDataTimestamp: Number.isFinite(Number(input.liquidity.marketDataTimestamp))
      ? Number(input.liquidity.marketDataTimestamp)
      : null,
  } : null;
  const portfolio = input.portfolio ? {
    initialEquity: input.portfolio.initialEquity,
    cash: input.portfolio.cash,
    equity: input.portfolio.equity,
    marketValue: input.portfolio.marketValue,
    realizedPnl: input.portfolio.realizedPnl,
    unrealizedPnl: input.portfolio.unrealizedPnl,
    totalPnl: input.portfolio.totalPnl,
    feesPaid: input.portfolio.feesPaid,
    drawdownPct: input.portfolio.drawdownPct,
    dailyPnlPct: input.portfolio.dailyPnlPct,
    openPositionCount: input.portfolio.positions.length,
    grossExposurePct: input.portfolio.equity > 0 ? input.portfolio.marketValue / input.portfolio.equity : null,
  } : null;
  const positionSizing = input.decision.action === 'ENTER' ? {
    mode: input.decision.positionSizingMode ?? null,
    requestedNotional: input.decision.notional,
    expectedLossAtStop: Number.isFinite(Number(input.decision.expectedLossAtStop))
      ? Number(input.decision.expectedLossAtStop)
      : null,
    stopLossPrice: input.decision.stopLossPrice,
    takeProfit1Price: input.decision.takeProfit1Price ?? null,
    takeProfit2Price: input.decision.takeProfit2Price ?? input.decision.takeProfitPrice,
    takeProfit1Fraction: input.decision.takeProfit1Fraction ?? null,
  } : null;

  return {
    liquidity,
    portfolioRisk: portfolio,
    positionSizing,
    riskInput: input.riskInput ? { ...input.riskInput } : null,
    proposedTradeMap: input.proposedTradeMap
      ? { ...input.proposedTradeMap, reasons: input.proposedTradeMap.reasons.slice() }
      : null,
  };
};

export const buildPreTradeShadowReview = (input: PreTradeShadowReviewInput): PreTradeShadowReview => {
  const market = input.market.toUpperCase();
  const forecast = buildEvidenceForecast(input.evidence);
  const router = buildStrategyRouterDecision(input.multiTimeframe, forecast);
  const council = buildShadowCouncil({
    market,
    decision: input.decision,
    multiTimeframe: input.multiTimeframe,
    evidence: input.evidence,
    microstructure: input.microstructure ?? null,
  });
  const arbiter = buildShadowArbiterRecommendation({
    action: input.decision.action,
    council,
    cycle: input.multiTimeframe.cycle ?? null,
    challenger: input.challenger ?? null,
  });

  return {
    stage: 'PRE_EXECUTION_SHADOW',
    executionAuthority: false,
    generatedAt: input.timestamp ?? Date.now(),
    market,
    reviewedAction: input.decision.action,
    forecast,
    router,
    council,
    arbiter,
    auditContext: snapshotAuditContext(input),
  };
};
