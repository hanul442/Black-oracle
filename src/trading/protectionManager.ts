import type { PaperPosition, TradingSnapshot } from './types';

export interface DynamicProtectionUpdate {
  market: string;
  currentPrice: number;
  highestPriceSinceEntry: number;
  stopLossPrice: number;
  takeProfit2Price: number | null;
  protectionRevision: number;
  changed: boolean;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Ratchets protection in the profitable direction only.
 * - stop-loss never moves lower for an existing long
 * - TP1 is intentionally fixed for qualification comparability
 * - TP2 may extend only in a strong trend, with a hard cap in R units
 */
export const buildDynamicProtectionUpdate = (
  position: PaperPosition,
  oneHour: TradingSnapshot,
  currentPrice: number,
): DynamicProtectionUpdate => {
  if (!(currentPrice > 0)) throw new Error('Dynamic protection requires a positive current price.');
  const initialStop = position.initialStopLossPrice ?? position.stopLossPrice ?? position.entryPrice * 0.98;
  const initialRisk = position.initialRiskPerUnit ?? Math.max(Number.EPSILON, position.entryPrice - initialStop);
  const highest = Math.max(position.highestPriceSinceEntry ?? position.entryPrice, currentPrice);
  const currentStop = position.stopLossPrice ?? initialStop;
  const reasons: string[] = [];

  let candidateStop = currentStop;
  const profitR = (currentPrice - position.entryPrice) / initialRisk;
  const highestR = (highest - position.entryPrice) / initialRisk;

  const swingLow = oneHour.structure?.lastSwingLow?.price ?? null;
  const structureTrail = swingLow && swingLow < currentPrice
    ? swingLow - oneHour.indicators.atr14 * 0.12
    : null;
  const atrMultiple = oneHour.regime.regime === 'STRONG_UPTREND' ? 1.8 : oneHour.regime.regime === 'UPTREND' ? 1.55 : 1.3;
  const atrTrail = currentPrice - oneHour.indicators.atr14 * atrMultiple;

  if (highestR >= 0.75) {
    // Once meaningful profit exists, remove most initial downside without choking the trade.
    candidateStop = Math.max(candidateStop, position.entryPrice - initialRisk * 0.15);
    reasons.push('Profit exceeded 0.75R; stop ratcheted close to breakeven.');
  }
  if (position.takeProfit1Taken || highestR >= 1.0) {
    candidateStop = Math.max(candidateStop, position.entryPrice);
    reasons.push('TP1/1R milestone reached; remaining position cannot return to a full initial loss.');
  }
  if (highestR >= 1.35) {
    candidateStop = Math.max(candidateStop, atrTrail);
    if (structureTrail != null) candidateStop = Math.max(candidateStop, structureTrail);
    reasons.push(`Runner mode active; stop trails ${atrMultiple.toFixed(2)} ATR and confirmed structure.`);
  }

  // Never place a stop at/above current price; preserve a small execution buffer.
  candidateStop = Math.min(candidateStop, currentPrice * 0.998);
  candidateStop = Math.max(currentStop, candidateStop);

  let takeProfit2Price = position.takeProfit2Price ?? position.takeProfitPrice ?? null;
  const strongTrend = oneHour.regime.regime === 'STRONG_UPTREND'
    && oneHour.momentum.directionalScore >= 35
    && oneHour.trend.directionalScore >= 45;
  const maxTp2 = position.entryPrice + initialRisk * 4.5;
  if (strongTrend && takeProfit2Price && currentPrice >= takeProfit2Price * 0.9 && takeProfit2Price < maxTp2) {
    const proposed = Math.min(maxTp2, Math.max(takeProfit2Price, currentPrice + initialRisk * 0.65));
    if (proposed > takeProfit2Price * 1.002) {
      takeProfit2Price = proposed;
      reasons.push('Strong trend persists near TP2; final target extended, capped at 4.5R.');
    }
  }

  if (oneHour.regime.regime === 'RANGE' || oneHour.momentum.directionalScore < -10) {
    reasons.push('No TP2 extension: trend persistence is insufficient.');
  }

  const changed = candidateStop > currentStop + Number.EPSILON
    || (takeProfit2Price != null && takeProfit2Price > (position.takeProfit2Price ?? position.takeProfitPrice ?? 0) + Number.EPSILON)
    || highest > (position.highestPriceSinceEntry ?? position.entryPrice);

  return {
    market: position.market,
    currentPrice,
    highestPriceSinceEntry: highest,
    stopLossPrice: clamp(candidateStop, initialStop, currentPrice * 0.998),
    takeProfit2Price,
    protectionRevision: (position.protectionRevision ?? 0) + (changed ? 1 : 0),
    changed,
    reasons,
  };
};
