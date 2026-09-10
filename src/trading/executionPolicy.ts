import { getAssetDecisionPolicy } from './assetPolicy';
import { buildPositionSizingDecision } from './positionSizing';
import { buildProtectionPlan } from './protectionPlan';
import { evaluateRisk } from './risk';
import type {
  ExecutionDecision,
  LiquiditySnapshot,
  MultiTimeframeSnapshot,
  PaperPortfolioSnapshot,
  PaperPosition,
  RiskCheckInput,
  TradingSnapshot,
} from './types';

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
  /** Applies only to NEW risk. Protective exits are evaluated before this gate. */
  newRiskEvidenceAllowed?: boolean;
}

export interface PreRiskExecutionCandidate {
  stage: 'PRE_RISK_CANDIDATE';
  decision: ExecutionDecision;
  riskRequired: boolean;
  riskInput: RiskCheckInput | null;
  passReasons: string[];
}

const withoutRiskEvaluation = (decision: Omit<ExecutionDecision, 'riskDisposition' | 'riskReasons'>): ExecutionDecision => ({
  ...decision,
  riskDisposition: 'NOT_EVALUATED',
  riskReasons: [],
});

const noRiskCandidate = (decision: ExecutionDecision): PreRiskExecutionCandidate => ({
  stage: 'PRE_RISK_CANDIDATE',
  decision,
  riskRequired: false,
  riskInput: null,
  passReasons: [],
});

const resolveMarketDataAgeMs = (input: ExecutionPolicyInput) => {
  const liveTimestamp = input.liquidity.marketDataTimestamp;
  if (Number.isFinite(liveTimestamp) && Number(liveTimestamp) > 0) {
    const now = Date.now();
    // Small exchange/local clock skew is tolerated, but a materially future timestamp
    // must never turn into an artificial age of zero. Fall back to the caller's
    // candle-derived age so the deterministic risk gate remains fail-closed.
    if (Number(liveTimestamp) <= now + 5_000) {
      return Math.max(0, now - Number(liveTimestamp));
    }
  }
  return input.marketDataAgeMs ?? 0;
};

export const buildPreRiskExecutionCandidate = (input: ExecutionPolicyInput): PreRiskExecutionCandidate => {
  const { liquidity, multiTimeframe, oneHour, portfolio, position } = input;
  const currentPrice = liquidity.tradePrice;
  const assetPolicy = getAssetDecisionPolicy(oneHour.market);

  // Existing-risk protection always has priority over evidence acquisition and
  // never waits for a Council/Risk approval round trip before an exit can execute.
  if (position) {
    if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
      return noRiskCandidate(withoutRiskEvaluation({
        action: 'EXIT', side: 'SELL', notional: currentPrice * position.quantity, quantity: position.quantity,
        confidence: 1, stopLossPrice: position.stopLossPrice, takeProfitPrice: position.takeProfitPrice,
        reasons: ['Protective stop-loss was reached.'],
      }));
    }

    const tp2 = position.takeProfit2Price ?? position.takeProfitPrice;
    if (tp2 && currentPrice >= tp2) {
      return noRiskCandidate(withoutRiskEvaluation({
        action: 'EXIT', side: 'SELL', notional: currentPrice * position.quantity, quantity: position.quantity,
        confidence: 1, stopLossPrice: position.stopLossPrice, takeProfitPrice: tp2,
        takeProfit1Price: position.takeProfit1Price ?? null,
        takeProfit2Price: tp2,
        reasons: ['Dynamic second take-profit target was reached; close the remaining position.'],
      }));
    }

    const tp1 = position.takeProfit1Price ?? null;
    if (tp1 && !position.takeProfit1Taken && currentPrice >= tp1) {
      const initialQuantity = position.initialQuantity ?? position.quantity;
      const fraction = Math.min(0.8, Math.max(0.2, position.takeProfit1Fraction ?? 0.4));
      const partialQuantity = Math.min(position.quantity, initialQuantity * fraction);
      return noRiskCandidate(withoutRiskEvaluation({
        action: 'EXIT', side: 'SELL', notional: currentPrice * partialQuantity, quantity: partialQuantity,
        confidence: 1, stopLossPrice: position.stopLossPrice, takeProfitPrice: tp2,
        takeProfit1Price: tp1,
        takeProfit2Price: tp2,
        takeProfit1Fraction: fraction,
        reasons: [`Dynamic first take-profit target was reached; realize ${(fraction * 100).toFixed(0)}% and retain the remainder for TP2.`],
      }));
    }

    if (multiTimeframe.action === 'SELL' || multiTimeframe.directionalScore <= -20) {
      return noRiskCandidate(withoutRiskEvaluation({
        action: 'EXIT', side: 'SELL', notional: currentPrice * position.quantity, quantity: position.quantity,
        confidence: multiTimeframe.confidence, stopLossPrice: position.stopLossPrice, takeProfitPrice: tp2,
        takeProfit1Price: position.takeProfit1Price ?? null,
        takeProfit2Price: tp2,
        reasons: ['Multi-timeframe direction reversed against the existing long spot position.'],
      }));
    }

    return noRiskCandidate(withoutRiskEvaluation({
      action: 'HOLD', side: null, notional: 0, quantity: 0, confidence: multiTimeframe.confidence,
      stopLossPrice: position.stopLossPrice, takeProfitPrice: tp2,
      takeProfit1Price: position.takeProfit1Price ?? null,
      takeProfit2Price: tp2,
      reasons: ['Existing position remains inside its dynamic protection plan and no exit signal is active.'],
    }));
  }

  if (input.newEntryAllowed === false) {
    const reason = 'Paper portfolio open-position limit rejected a new entry.';
    return noRiskCandidate({
      action: 'HOLD', side: null, notional: 0, quantity: 0, confidence: multiTimeframe.confidence,
      stopLossPrice: null, takeProfitPrice: null, riskDisposition: 'REJECT', riskReasons: [reason], reasons: [reason],
    });
  }

  if (!liquidity.eligible) {
    return noRiskCandidate(withoutRiskEvaluation({
      action: 'HOLD', side: null, notional: 0, quantity: 0, confidence: 0,
      stopLossPrice: null, takeProfitPrice: null,
      reasons: ['Liquidity gate rejected this market.', ...liquidity.reasons],
    }));
  }

  if (multiTimeframe.action !== 'BUY' || multiTimeframe.confidence < 0.62) {
    return noRiskCandidate(withoutRiskEvaluation({
      action: 'HOLD', side: null, notional: 0, quantity: 0, confidence: multiTimeframe.confidence,
      stopLossPrice: null, takeProfitPrice: null,
      reasons: ['A new spot entry requires BUY consensus with at least 62% confidence.'],
    }));
  }

  // Crypto is technical-first and may open Paper risk without news/evidence.
  // Equities remain evidence-first and must wait for source-backed context.
  if (assetPolicy.evidenceRequiredForNewRisk && input.newRiskEvidenceAllowed === false) {
    return noRiskCandidate(withoutRiskEvaluation({
      action: 'HOLD', side: null, notional: 0, quantity: 0, confidence: multiTimeframe.confidence,
      stopLossPrice: null, takeProfitPrice: null,
      reasons: [
        `${assetPolicy.assetClass} policy requires source-backed evidence before new risk is opened.`,
        'Request NARS coverage, analyze the returned evidence, then re-evaluate on a fresh market snapshot.',
      ],
    }));
  }

  const protection = buildProtectionPlan(oneHour, currentPrice);
  const sizing = buildPositionSizingDecision({
    equity: portfolio.equity,
    cash: portfolio.cash,
    stopDistancePct: protection.stopDistancePct,
    mode: 'EQUAL_NOTIONAL_RISK_CAPPED',
    targetNotionalPct: 0.10,
    maxNotionalPct: 0.15,
    maxRiskPerTradePct: 0.005,
  });
  const estimatedSlippageBps = Math.max(8, liquidity.spreadBps / 2 + 5);
  const evidenceReason = assetPolicy.evidenceRequiredForNewRisk
    ? 'Asset-specific source-backed evidence gate passed.'
    : input.newRiskEvidenceAllowed === false
      ? 'Crypto technical-first policy allows Paper entry without external evidence; evidence remains supplementary.'
      : 'External evidence is available as supplementary context under the crypto technical-first policy.';

  const decision = withoutRiskEvaluation({
    action: 'ENTER',
    side: 'BUY',
    notional: sizing.requestedNotional,
    quantity: 0,
    confidence: multiTimeframe.confidence,
    stopLossPrice: protection.stopLossPrice,
    takeProfitPrice: protection.takeProfit2Price,
    takeProfit1Price: protection.takeProfit1Price,
    takeProfit2Price: protection.takeProfit2Price,
    takeProfit1Fraction: protection.takeProfit1Fraction,
    protectionBasis: protection.basis,
    positionSizingMode: sizing.mode,
    expectedLossAtStop: sizing.expectedLossAtStop,
    reasons: [
      'Liquidity and multi-timeframe technical consensus passed; candidate awaits deterministic risk evaluation.',
      evidenceReason,
      ...sizing.reasons,
      ...protection.reasons,
    ],
  });

  return {
    stage: 'PRE_RISK_CANDIDATE',
    decision,
    riskRequired: true,
    riskInput: {
      equity: portfolio.equity,
      requestedNotional: sizing.requestedNotional,
      dailyPnlPct: portfolio.dailyPnlPct,
      totalDrawdownPct: portfolio.drawdownPct,
      estimatedSlippageBps,
      marketDataAgeMs: resolveMarketDataAgeMs(input),
      feedConnected: input.feedConnected ?? true,
      ledgerInSync: input.ledgerInSync ?? true,
      duplicateOrderDetected: input.duplicateOrderDetected ?? false,
    },
    passReasons: [
      evidenceReason,
      ...sizing.reasons,
      ...protection.reasons,
    ],
  };
};

export const applyDeterministicRiskToCandidate = (candidate: PreRiskExecutionCandidate): ExecutionDecision => {
  if (!candidate.riskRequired || !candidate.riskInput) return candidate.decision;

  const risk = evaluateRisk(candidate.riskInput);
  if (risk.status === 'REJECT') {
    return {
      action: 'HOLD', side: null, notional: 0, quantity: 0, confidence: candidate.decision.confidence,
      stopLossPrice: null, takeProfitPrice: null,
      riskDisposition: 'REJECT', riskReasons: risk.reasons.slice(),
      reasons: ['Deterministic risk gate rejected the candidate.', ...risk.reasons],
    };
  }

  return {
    ...candidate.decision,
    notional: risk.approvedNotional,
    riskDisposition: 'APPROVE',
    riskReasons: risk.reasons.slice(),
    reasons: [
      'Liquidity, multi-timeframe technical consensus and deterministic risk gates passed.',
      ...candidate.passReasons,
    ],
  };
};

export const buildExecutionDecision = (input: ExecutionPolicyInput): ExecutionDecision =>
  applyDeterministicRiskToCandidate(buildPreRiskExecutionCandidate(input));
