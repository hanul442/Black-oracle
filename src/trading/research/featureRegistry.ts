export type TechnicalResearchFamily =
  | 'TREND'
  | 'TREND_STRENGTH'
  | 'MOMENTUM'
  | 'BREAKOUT'
  | 'MEAN_REVERSION'
  | 'STRUCTURE'
  | 'LOCATION'
  | 'VOLUME_WEIGHTED_LOCATION'
  | 'VOLUME'
  | 'MICROSTRUCTURE'
  | 'VOLATILITY'
  | 'RELATIVE_STRENGTH';

export type TechnicalFeatureStatus =
  | 'EXPERIMENTAL'
  | 'SHADOW'
  | 'VALIDATED'
  | 'REJECTED'
  | 'REJECTED_REDUNDANT'
  | 'PROMOTION_CANDIDATE'
  | 'CHALLENGER'
  | 'PRODUCTION';

export type ResearchTimeframe = '4H' | '1H' | '15M';

export interface TechnicalFeatureDefinition {
  featureId: string;
  featureFamily: TechnicalResearchFamily;
  featureVersion: string;
  timeframes: ResearchTimeframe[];
  role: 'DIRECTIONAL' | 'CONTEXTUAL';
  requiresVolume: boolean;
  requiresUniverse: boolean;
  requiresMicrostructure: boolean;
  lookback: number;
  normalization: string;
  status: TechnicalFeatureStatus;
}

export const TECHNICAL_FEATURE_REGISTRY: readonly TechnicalFeatureDefinition[] = Object.freeze([
  {
    featureId: 'breakout.donchian.v1',
    featureFamily: 'BREAKOUT',
    featureVersion: '1.0.0',
    timeframes: ['4H', '1H', '15M'],
    role: 'DIRECTIONAL',
    requiresVolume: true,
    requiresUniverse: false,
    requiresMicrostructure: false,
    lookback: 51,
    normalization: 'ATR-normalized breakout distance; range position preserved raw',
    status: 'SHADOW',
  },
  {
    featureId: 'trend-strength.adx-dmi.v1',
    featureFamily: 'TREND_STRENGTH',
    featureVersion: '1.0.0',
    timeframes: ['4H', '1H', '15M'],
    role: 'CONTEXTUAL',
    requiresVolume: false,
    requiresUniverse: false,
    requiresMicrostructure: false,
    lookback: 30,
    normalization: 'ADX/100 with signed DI spread retained separately',
    status: 'SHADOW',
  },
  {
    featureId: 'relative-strength.cross-sectional.v1',
    featureFamily: 'RELATIVE_STRENGTH',
    featureVersion: '1.0.0',
    timeframes: ['4H', '1H', '15M'],
    role: 'DIRECTIONAL',
    requiresVolume: false,
    requiresUniverse: true,
    requiresMicrostructure: false,
    lookback: 97,
    normalization: 'point-in-time universe percentile rank centered at 0.5',
    status: 'SHADOW',
  },
  {
    featureId: 'volume-weighted-location.rolling-vwap.v1',
    featureFamily: 'VOLUME_WEIGHTED_LOCATION',
    featureVersion: '1.0.0',
    timeframes: ['4H', '1H', '15M'],
    role: 'CONTEXTUAL',
    requiresVolume: true,
    requiresUniverse: false,
    requiresMicrostructure: false,
    lookback: 51,
    normalization: 'price minus rolling VWAP divided by ATR',
    status: 'SHADOW',
  },
  {
    featureId: 'volatility.realized-ratio.v1',
    featureFamily: 'VOLATILITY',
    featureVersion: '1.0.0',
    timeframes: ['4H', '1H', '15M'],
    role: 'CONTEXTUAL',
    requiresVolume: false,
    requiresUniverse: false,
    requiresMicrostructure: false,
    lookback: 60,
    normalization: 'log RV20/RV50 ratio; Parkinson range estimator retained raw',
    status: 'SHADOW',
  },
]);

export const getTechnicalFeatureDefinition = (featureId: string) =>
  TECHNICAL_FEATURE_REGISTRY.find((feature) => feature.featureId === featureId) ?? null;
