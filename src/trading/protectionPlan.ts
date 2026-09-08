import type { MarketRegime, TradingSnapshot } from './types';

export interface ProtectionPlan {
  entryPrice: number;
  stopLossPrice: number;
  takeProfit1Price: number;
  takeProfit2Price: number;
  stopDistancePct: number;
  riskPerUnit: number;
  takeProfit1R: number;
  takeProfit2R: number;
  takeProfit1Fraction: number;
  takeProfit2Fraction: number;
  moveStopToBreakevenAfterTp1: boolean;
  basis: 'STRUCTURE_ATR' | 'ATR';
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const regimeTargets = (regime: MarketRegime) => {
  switch (regime) {
    case 'STRONG_UPTREND': return { tp1R: 1.25, tp2R: 3.0, tp1Fraction: 0.35 };
    case 'UPTREND': return { tp1R: 1.15, tp2R: 2.4, tp1Fraction: 0.40 };
    case 'RANGE': return { tp1R: 0.9, tp2R: 1.7, tp1Fraction: 0.55 };
    default: return { tp1R: 1.0, tp2R: 2.0, tp1Fraction: 0.50 };
  }
};

/**
 * Dynamic protection replaces the legacy fixed -1%/+2% shape.
 * Stop distance comes from ATR and confirmed structure; reward targets adapt to regime.
 */
export const buildProtectionPlan = (oneHour: TradingSnapshot, entryPrice: number): ProtectionPlan => {
  if (!(entryPrice > 0)) throw new Error('Protection plan requires a positive entry price.');
  const atrDistance = Math.max(entryPrice * 0.006, oneHour.indicators.atr14 * 1.6);
  const structureLow = oneHour.structure?.lastSwingLow?.price ?? null;
  const structureDistance = structureLow && structureLow < entryPrice
    ? entryPrice - structureLow + oneHour.indicators.atr14 * 0.18
    : null;

  let rawDistance = atrDistance;
  let basis: ProtectionPlan['basis'] = 'ATR';
  if (structureDistance && structureDistance / entryPrice >= 0.006 && structureDistance / entryPrice <= 0.06) {
    rawDistance = Math.max(atrDistance * 0.8, structureDistance);
    basis = 'STRUCTURE_ATR';
  }

  const stopDistancePct = clamp(rawDistance / entryPrice, 0.0075, 0.05);
  const riskPerUnit = entryPrice * stopDistancePct;
  const stopLossPrice = entryPrice - riskPerUnit;
  const targets = regimeTargets(oneHour.regime.regime);

  // If a confirmed prior swing-high gives a sensible first objective, respect it.
  const structureHigh = oneHour.structure?.lastSwingHigh?.price ?? null;
  const structureHighR = structureHigh && structureHigh > entryPrice
    ? (structureHigh - entryPrice) / riskPerUnit
    : null;
  const takeProfit1R = structureHighR && structureHighR >= 0.75 && structureHighR <= 1.8
    ? structureHighR
    : targets.tp1R;
  const takeProfit2R = Math.max(targets.tp2R, takeProfit1R + 0.7);
  const takeProfit1Fraction = targets.tp1Fraction;

  return {
    entryPrice,
    stopLossPrice,
    takeProfit1Price: entryPrice + riskPerUnit * takeProfit1R,
    takeProfit2Price: entryPrice + riskPerUnit * takeProfit2R,
    stopDistancePct,
    riskPerUnit,
    takeProfit1R,
    takeProfit2R,
    takeProfit1Fraction,
    takeProfit2Fraction: 1 - takeProfit1Fraction,
    moveStopToBreakevenAfterTp1: true,
    basis,
    reasons: [
      `${basis} protection selected; stop distance is ${(stopDistancePct * 100).toFixed(2)}% instead of a fixed percentage.`,
      `TP1 is ${takeProfit1R.toFixed(2)}R and realizes ${(takeProfit1Fraction * 100).toFixed(0)}% of the position.`,
      `TP2 is ${takeProfit2R.toFixed(2)}R for the remainder; stop moves to entry after TP1 when feasible.`,
    ],
  };
};
