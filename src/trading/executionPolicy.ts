import { DEFAULT_RISK_LIMITS } from './config';
import { evaluateRisk } from './risk';
import type {
  ExecutionDecision,
  LiquiditySnapshot,
  MultiTimeframeSnapshot,
  PaperPortfolioSnapshot,
  PaperPosition,
  TradingSnapshot,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface ExecutionPolicyInput {
  liquidity: LiquiditySnapshot;
  multiTimeframe: MultiTimeframeSnapshot;
  oneHour: TradingSnapshot;
  portfolio: PaperPortfolioSnapshot;
  position: PaperPosition | null;
  marketDataAgeMs?: number;
  feedConnected?: boolean;
  ledgerInSync?: boolean;
  duplicateOrderDetected?: boolean;
  newEntryAllowed?: boolean;
}

const withoutRiskEvaluation = (decision: Omit<ExecutionDecision, 'riskDisposition' | 'riskReasons'>): ExecutionDecision => ({
  ...decision,
  riskDisposition: 'NOT_EVALUATED',
  riskReasons: [],
});

export const buildExecutionDecision = (input: ExecutionPolicyInput): ExecutionDecision => {
  const { liquidity, multiTimeframe, oneHour, portfolio, position } = input;
  const currentPrice = liquidity.tradePrice;

  if (position) {
    if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
      return withoutRiskEvaluation({
        action: 'EXIT',
        side: 'SELL',
        notional: currentPrice * position.quantity,
        quantity: position.quantity,
        confidence: 1,
        stopLossPrice: position.stopLossPrice,
        takeProfitPrice: position.takeProfitPrice,
        reasons: ['Protective stop-loss was reached.'],
      });
    }
    if (position.takeProfitPrice && currentPrice >= position.takeProfitPrice) {
      return withoutRiskEvaluation({
        action: 'EXIT',
        side: 'SELL',
        notional: currentPrice * position.quantity,
        quantity: position.quantity,
        confidence: 1,
        stopLossPrice: position.stopLossPrice,
        takeProfitPrice: position.takeProfitPrice,
        reasons: ['Protective take-profit was reached.'],
      });
    }
    if (multiTimeframe.action === 'SELL' || multiTimeframe.directionalScore <= -20) {
      return withoutRiskEvaluation({
        action: 'EXIT',
        side: 'SELL',
        notional: currentPrice * position.quantity,
        quantity: position.quantity,
        confidence: multiTimeframe.confidence,
        stopLossPrice: position.stopLossPrice,
        takeProfitPrice: position.takeProfitPrice,
        reasons: ['Multi-timeframe direction reversed against the existing long spot position.'],
      });
    }

    return withoutRiskEvaluation({
      action: 'HOLD',
      side: null,
      notional: 0,
      quantity: 0,
      confidence: multiTimeframe.confidence,
      stopLossPrice: position.stopLossPrice,
      takeProfitPrice: position.takeProfitPrice,
      reasons: ['Existing position remains inside its protective levels and no exit signal is active.'],
    });
  }

  if (input.newEntryAllowed === false) {
    const reason = 'Paper portfolio open-position limit rejected a new entry.';
    return {
      action: 'HOLD',
      side: null,
      notional: 0,
      quantity: 0,
      confidence: multiTimeframe.confidence,
      stopLossPrice: null,
      takeProfitPrice: null,
      riskDisposition: 'REJECT',
      riskReasons: [reason],
      reasons: [reason],
    };
  }

  if (!liquidity.eligible) {
    return withoutRiskEvaluation({
      action: 'HOLD',
      side: null,
      notional: 0,
      quantity: 0,
      confidence: 0,
      stopLossPrice: null,
      takeProfitPrice: null,
      reasons: ['Liquidity gate rejected this market.', ...liquidity.reasons],
    });
  }

  if (multiTimeframe.action !== 'BUY' || multiTimeframe.confidence < 0.62) {
    return withoutRiskEvaluation({
      action: 'HOLD',
      side: null,
      notional: 0,
      quantity: 0,
      confidence: multiTimeframe.confidence,
      stopLossPrice: null,
      takeProfitPrice: null,
      reasons: ['A new spot entry requires BUY consensus with at least 62% confidence.'],
    });
  }

  const conviction = clamp((multiTimeframe.directionalScore - 20) / 50, 0.35, 1);
  const requestedNotional = portfolio.equity * DEFAULT_RISK_LIMITS.maxPositionPct * conviction * multiTimeframe.positionRiskMultiplier;
  const estimatedSlippageBps = Math.max(8, liquidity.spreadBps / 2 + 5);
  const risk = evaluateRisk({
    equity: portfolio.equity,
    requestedNotional,
    dailyPnlPct: portfolio.dailyPnlPct,
    totalDrawdownPct: portfolio.drawdownPct,
    estimatedSlippageBps,
    marketDataAgeMs: input.marketDataAgeMs ?? 0,
    feedConnected: input.feedConnected ?? true,
    ledgerInSync: input.ledgerInSync ?? true,
    duplicateOrderDetected: input.duplicateOrderDetected ?? false,
  });

  if (risk.status === 'REJECT') {
    return {
      action: 'HOLD',
      side: null,
      notional: 0,
      quantity: 0,
      confidence: multiTimeframe.confidence,
      stopLossPrice: null,
      takeProfitPrice: null,
      riskDisposition: 'REJECT',
      riskReasons: risk.reasons.slice(),
      reasons: ['Deterministic risk gate rejected the candidate.', ...risk.reasons],
    };
  }

  const stopDistancePct = clamp(oneHour.indicators.atrPct * 1.8, 0.012, 0.04);
  const stopLossPrice = currentPrice * (1 - stopDistancePct);
  const takeProfitPrice = currentPrice * (1 + stopDistancePct * 2);

  return {
    action: 'ENTER',
    side: 'BUY',
    notional: risk.approvedNotional,
    quantity: 0,
    confidence: multiTimeframe.confidence,
    stopLossPrice,
    takeProfitPrice,
    riskDisposition: 'APPROVE',
    riskReasons: risk.reasons.slice(),
    reasons: [
      'Liquidity, multi-timeframe consensus, confidence, and deterministic risk gates all passed.',
      `Initial stop uses ${Math.round(stopDistancePct * 10_000)} bps; take-profit is set at 2R.`,
    ],
  };
};