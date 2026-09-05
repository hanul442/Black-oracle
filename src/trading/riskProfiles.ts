import { buildMonteCarloValidation, type MonteCarloValidation } from './monteCarlo';

export type PaperRiskProfileId = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export interface PaperRiskProfile {
  id: PaperRiskProfileId;
  label: string;
  maxPositionPct: number;
  maxOpenPositions: number;
  grossExposureCapPct: number;
  cryptoClusterExposureCapPct: number;
  maxDailyLossPct: number;
  maxTotalDrawdownPct: number;
  executionAuthority: false;
}

export interface RiskProfileValidation {
  profile: PaperRiskProfile;
  validation: MonteCarloValidation;
  normalizedTradeCount: number;
  normalization: {
    source: 'POSITION_RETURN';
    output: 'ACCOUNT_IMPACT_RETURN';
    allocationAssumptionPct: number;
    concurrencyModeled: false;
    correlationModeled: false;
  };
  promotionAuthority: false;
}

export const PAPER_RISK_PROFILES: Readonly<Record<PaperRiskProfileId, PaperRiskProfile>> = Object.freeze({
  CONSERVATIVE: Object.freeze({
    id: 'CONSERVATIVE',
    label: 'Conservative',
    maxPositionPct: 0.02,
    maxOpenPositions: 4,
    grossExposureCapPct: 0.08,
    cryptoClusterExposureCapPct: 0.06,
    maxDailyLossPct: 0.01,
    maxTotalDrawdownPct: 0.05,
    executionAuthority: false,
  }),
  BALANCED: Object.freeze({
    id: 'BALANCED',
    label: 'Balanced',
    maxPositionPct: 0.03,
    maxOpenPositions: 4,
    grossExposureCapPct: 0.12,
    cryptoClusterExposureCapPct: 0.09,
    maxDailyLossPct: 0.015,
    maxTotalDrawdownPct: 0.07,
    executionAuthority: false,
  }),
  AGGRESSIVE: Object.freeze({
    id: 'AGGRESSIVE',
    label: 'Aggressive Paper',
    maxPositionPct: 0.05,
    maxOpenPositions: 4,
    grossExposureCapPct: 0.20,
    cryptoClusterExposureCapPct: 0.15,
    maxDailyLossPct: 0.02,
    maxTotalDrawdownPct: 0.10,
    executionAuthority: false,
  }),
});

export const normalizePositionReturnsToAccountImpact = (
  positionReturns: number[],
  allocationPct: number,
) => {
  if (!Number.isFinite(allocationPct) || allocationPct <= 0 || allocationPct > 1) {
    throw new Error('allocationPct must be greater than 0 and at most 1.');
  }
  return positionReturns
    .filter((value) => Number.isFinite(value) && value > -1 && value < 10)
    .map((value) => value * allocationPct);
};

export const validateRiskProfile = (
  positionReturns: number[],
  profile: PaperRiskProfile,
): RiskProfileValidation => {
  const accountImpactReturns = normalizePositionReturnsToAccountImpact(positionReturns, profile.maxPositionPct);

  // Existing closed-trade returns already include realized trading fees. The extra Monte Carlo
  // stress drag is converted from position-level stress into account-level stress by the same
  // allocation assumption, preventing a 10 bps position stress from becoming 10 bps of whole-account loss.
  const validation = buildMonteCarloValidation(accountImpactReturns, {
    seed: 20_260_904,
    scenarioCount: 1_000,
    minTrades: 20,
    drawdownLimitPct: profile.maxTotalDrawdownPct,
    costInflationBps: 10 * profile.maxPositionPct,
    adverseShockPct: 0.001 * profile.maxPositionPct,
    winnerHaircut: 0.85,
    loserAmplification: 1.1,
  });

  return Object.freeze({
    profile,
    validation,
    normalizedTradeCount: accountImpactReturns.length,
    normalization: Object.freeze({
      source: 'POSITION_RETURN' as const,
      output: 'ACCOUNT_IMPACT_RETURN' as const,
      allocationAssumptionPct: profile.maxPositionPct,
      concurrencyModeled: false as const,
      correlationModeled: false as const,
    }),
    promotionAuthority: false as const,
  });
};

export const buildRiskProfileComparison = (positionReturns: number[]) => (
  [PAPER_RISK_PROFILES.CONSERVATIVE, PAPER_RISK_PROFILES.BALANCED, PAPER_RISK_PROFILES.AGGRESSIVE]
    .map((profile) => validateRiskProfile(positionReturns, profile))
);
