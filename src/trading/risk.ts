import { DEFAULT_RISK_LIMITS } from './config';
import type { RiskCheckInput, RiskDecision, RiskLimits } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type RiskEvaluationInput = Omit<
  RiskCheckInput,
  'entryPrice' | 'stopLossPrice' | 'takeProfit1Price' | 'takeProfit2Price' | 'expectedLossAtStop'
> & Partial<Pick<
  RiskCheckInput,
  'entryPrice' | 'stopLossPrice' | 'takeProfit1Price' | 'takeProfit2Price' | 'expectedLossAtStop'
>>;

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
  input: RiskEvaluationInput,
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

  const protectionComplete = [
    input.entryPrice,
    input.stopLossPrice,
    input.takeProfit1Price,
    input.takeProfit2Price,
    input.expectedLossAtStop,
  ].every((value) => Number.isFinite(value));

  if (!protectionComplete) {
    reasons.push('Dynamic protection data is incomplete; new risk fails closed independently of the Daily loss limit until entry, stop, TP1, TP2, and expected stop-loss are supplied.');
  } else {
    const entryPrice = Number(input.entryPrice);
    const stopLossPrice = Number(input.stopLossPrice);
    const takeProfit1Price = Number(input.takeProfit1Price);
    const takeProfit2Price = Number(input.takeProfit2Price);
    const expectedLossAtStop = Number(input.expectedLossAtStop);
    const validEntry = entryPrice > 0;
    const validStop = stopLossPrice > 0 && validEntry && stopLossPrice < entryPrice;
    const validTp1 = validEntry && takeProfit1Price > entryPrice;
    const validTp2 = validTp1 && takeProfit2Price > takeProfit1Price;
    if (!validEntry) reasons.push('Dynamic protection requires a positive entry price.');
    if (!validStop) reasons.push('Dynamic stop-loss must be positive and below the planned entry price.');
    if (!validTp1) reasons.push('Dynamic TP1 must be above the planned entry price.');
    if (!validTp2) reasons.push('Dynamic TP2 must be above TP1.');

    const expectedLossAtStopPct = input.equity > 0 ? expectedLossAtStop / input.equity : Number.POSITIVE_INFINITY;
    if (expectedLossAtStop <= 0) {
      reasons.push('Expected loss at the planned stop must be positive and finite.');
    } else if (expectedLossAtStopPct > limits.maxRiskPerTradePct + 1e-9) {
      reasons.push(`Planned stop loss exceeds the ${(limits.maxRiskPerTradePct * 100).toFixed(2)}% per-trade equity risk budget.`);
    } else {
      passReasons.push(`Dynamic protection validated; planned loss at stop is ${(expectedLossAtStopPct * 100).toFixed(2)}% of equity.`);
    }
  }

  if (input.dailyPnlPct <= -limits.maxDailyLossPct) {
    reasons.push(`Daily loss limit reached: emergency daily loss stop of ${(limits.maxDailyLossPct * 100).toFixed(2)}% has been reached.`);
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
