import type { TradingHorizon } from './horizonPolicy';

export interface HorizonPositionIdentity {
  market: string;
  horizon: TradingHorizon;
  strategyId: string;
  positionKey: string;
}

const safe = (value: string) => value.trim().replace(/[^A-Za-z0-9_.-]+/g, '_');

/**
 * V10 shadow identity. Existing S1R2 market-keyed Paper positions remain untouched until
 * a separately qualified migration enables multi-horizon execution.
 */
export const buildHorizonPositionIdentity = (
  market: string,
  horizon: TradingHorizon,
  strategyId: string,
): HorizonPositionIdentity => {
  const normalizedMarket = safe(market.toUpperCase());
  const normalizedStrategy = safe(strategyId || 'UNSPECIFIED');
  return {
    market: normalizedMarket,
    horizon,
    strategyId: normalizedStrategy,
    positionKey: `${normalizedMarket}::${horizon}::${normalizedStrategy}`,
  };
};

export interface HorizonSleeveLimit {
  horizon: TradingHorizon;
  maxGrossExposurePct: number;
  maxSinglePositionPct: number;
}

export const validateHorizonSleeveLimits = (limits: HorizonSleeveLimit[]) => {
  const errors: string[] = [];
  const seen = new Set<TradingHorizon>();
  for (const limit of limits) {
    if (seen.has(limit.horizon)) errors.push(`Duplicate horizon sleeve ${limit.horizon}.`);
    seen.add(limit.horizon);
    if (!Number.isFinite(limit.maxGrossExposurePct) || limit.maxGrossExposurePct <= 0 || limit.maxGrossExposurePct > 1) errors.push(`${limit.horizon} maxGrossExposurePct must be in (0,1].`);
    if (!Number.isFinite(limit.maxSinglePositionPct) || limit.maxSinglePositionPct <= 0 || limit.maxSinglePositionPct > limit.maxGrossExposurePct) errors.push(`${limit.horizon} maxSinglePositionPct must be in (0,maxGrossExposurePct].`);
  }
  const totalGross = limits.reduce((sum, limit) => sum + limit.maxGrossExposurePct, 0);
  if (totalGross > 1 + 1e-9) errors.push('Sum of horizon gross-exposure caps must not exceed shared capital before leverage is explicitly approved.');
  return { valid: errors.length === 0, totalGross, errors };
};
