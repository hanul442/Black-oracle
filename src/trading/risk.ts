import { DEFAULT_RISK_LIMITS } from './config';
import type { RiskCheckInput, RiskDecision, RiskLimits } from './types';

export const evaluateRisk = (
  input: RiskCheckInput,
  limits: RiskLimits = DEFAULT_RISK_LIMITS,
): RiskDecision => {
  const reasons: string[] = [];
  const maxAllowedNotional = Math.max(0, input.equity * limits.maxPositionPct);

  if (!Number.isFinite(input.equity) || input.equity <= 0) reasons.push('Account equity must be positive and finite.');
  if (!Number.isFinite(input.requestedNotional) || input.requestedNotional <= 0) reasons.push('Requested notional must be positive and finite.');
  if (input.requestedNotional > maxAllowedNotional) {
    reasons.push(`Requested position exceeds ${(limits.maxPositionPct * 100).toFixed(2)}% of account equity.`);
  }
  if (input.dailyPnlPct <= -limits.maxDailyLossPct) {
    reasons.push(`Daily loss limit of ${(limits.maxDailyLossPct * 100).toFixed(2)}% has been reached.`);
  }
  if (Math.max(0, input.totalDrawdownPct) >= limits.maxTotalDrawdownPct) {
    reasons.push(`Total drawdown limit of ${(limits.maxTotalDrawdownPct * 100).toFixed(2)}% has been reached.`);
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
      reasons,
    };
  }

  return {
    status: 'PASS',
    approvedNotional: input.requestedNotional,
    maxAllowedNotional,
    reasons: ['All deterministic risk gates passed.'],
  };
};
