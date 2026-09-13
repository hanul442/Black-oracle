import { DEFAULT_RISK_LIMITS } from './config';
import type { RiskCheckInput, RiskDecision, RiskLimits } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const dailyLossNotionalScale = (
  dailyPnlPct: number,
  limits: RiskLimits = DEFAULT_RISK_LIMITS,
) => {
  const realizedLossPct = Math.max(0, -Number(dailyPnlPct || 0));
  if (realizedLossPct <= limits.dailyLossThrottleStartPct) return 1;
  const span = Math.max(Number.EPSILON, limits.maxDailyLossPct - limits.dailyLossThrottleStartPct);
  const progress = clamp((realizedLossPct - limits.dailyLossThrottleStartPct) / span, 0, 1);
  return clamp(
    1 - progress * (1 - limits.minDailyLossNotionalScale),
    limits.minDailyLossNotionalScale,
    1,
  );
};

export const evaluateRisk = (
  input: RiskCheckInput,
  limits: RiskLimits = DEFAULT_RISK_LIMITS,
): RiskDecision => {
  const reasons: string[] = [];
  const passReasons: string[] = [];
  const maxAllowedNotional = Math.max(0, input.equity * limits.maxPositionPct);

  if (!Number.isFinite(input.equity) || input.equity <= 0) reasons.push('Account equity must be positive and finite.');
  if (!Number.isFinite(input.requestedNotional) || input.requestedNotional <= 0) reasons.push('Requested notional must be positive and finite.');
  if (input.requestedNotional > maxAllowedNotional) {
    reasons.push(`Requested position exceeds ${(limits.maxPositionPct * 100).toFixed(2)}% of account equity.`);
  }

  const validEntry = Number.isFinite(input.entryPrice) && input.entryPrice > 0;
  const validStop = Number.isFinite(input.stopLossPrice) && input.stopLossPrice > 0 && validEntry && input.stopLossPrice < input.entryPrice;
  const validTp1 = Number.isFinite(input.takeProfit1Price) && validEntry && input.takeProfit1Price > input.entryPrice;
  const validTp2 = Number.isFinite(input.takeProfit2Price) && validTp1 && input.takeProfit2Price > input.takeProfit1Price;
  if (!validEntry) reasons.push('Dynamic protection requires a positive entry price.');
  if (!validStop) reasons.push('Dynamic stop-loss must be positive and below the planned entry price.');
  if (!validTp1) reasons.push('Dynamic TP1 must be above the planned entry price.');
  if (!validTp2) reasons.push('Dynamic TP2 must be above TP1.');

  const expectedLossAtStopPct = input.equity > 0 ? input.expectedLossAtStop / input.equity : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(input.expectedLossAtStop) || input.expectedLossAtStop <= 0) {
    reasons.push('Expected loss at the planned stop must be positive and finite.');
  } else if (expectedLossAtStopPct > limits.maxRiskPerTradePct + 1e-9) {
    reasons.push(`Planned stop loss exceeds the ${(limits.maxRiskPerTradePct * 100).toFixed(2)}% per-trade equity risk budget.`);
  } else {
    passReasons.push(`Dynamic protection validated; planned loss at stop is ${(expectedLossAtStopPct * 100).toFixed(2)}% of equity.`);
  }

  if (input.dailyPnlPct <= -limits.maxDailyLossPct) {
    reasons.push(`Emergency daily loss stop of ${(limits.maxDailyLossPct * 100).toFixed(2)}% has been reached.`);
  }
  if (Math.max(0, input.totalDrawdownPct) >= limits.maxTotalDrawdownPct) {
    reasons.push(`Total drawdown emergency stop of ${(limits.maxTotalDrawdownPct * 100).toFixed(2)}% has been reached.`);
  }
  if (!input.feedConnected) reasons.push('Market feed is disconnected.');
  if (input.marketDataAgeMs > limits.maxMarketDataAgeMs) reasons.push('Market data is stale.');
  if (!input.ledgerInSync) reasons.push('Internal ledger is not reconciled with the execution venue.');
  if (input.duplicateOrderDetected) reasons.push('Duplicate order fingerprint detected.');
  if (input.estimatedSlippageBps > limits.maxEstimatedSlippageBps) {
    reasons.push(`Estimated slippage exceeds ${limits.maxEstimatedSlippageBps} bps.`);
  }

  if (reasons.length > 0) {
    return {
      status: 'REJECT',
      approvedNotional: 0,
      maxAllowedNotional,
      notionalScale: 0,
      reasons,
    };
  }

  const notionalScale = dailyLossNotionalScale(input.dailyPnlPct, limits);
  const approvedNotional = Math.min(input.requestedNotional, maxAllowedNotional) * notionalScale;
  if (notionalScale < 1) {
    passReasons.push(
      `Daily-loss throttle is active: new-risk notional reduced to ${(notionalScale * 100).toFixed(0)}% while preserving the candidate-specific stop and targets.`,
    );
  } else {
    passReasons.push(`Daily-loss throttle inactive below ${(limits.dailyLossThrottleStartPct * 100).toFixed(2)}% loss.`);
  }

  return {
    status: 'PASS',
    approvedNotional,
    maxAllowedNotional,
    notionalScale,
    reasons: passReasons,
  };
};
