export type TradingHorizon = 'ULTRA_SHORT' | 'SHORT' | 'MEDIUM' | 'MEDIUM_LONG' | 'LONG';

export type CanonicalTimeframe = '1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W' | '1MO';

export type TimeframePurpose = 'ENTRY' | 'CONFIRMATION' | 'STRUCTURE' | 'REGIME' | 'RISK';

export interface HorizonTimeframeRule {
  timeframe: CanonicalTimeframe;
  weight: number;
  purpose: TimeframePurpose[];
  required: boolean;
}

export interface HorizonStrategyPolicy {
  horizon: TradingHorizon;
  label: string;
  intendedHoldingPeriod: string;
  rebalanceCadence: string;
  primaryStrategyFamilies: string[];
  evidenceFreshness: string;
  timeframeRules: HorizonTimeframeRule[];
  minimumIndependentConfirmations: number;
  notes: string[];
}

export const HORIZON_STRATEGY_POLICIES: Record<TradingHorizon, HorizonStrategyPolicy> = {
  ULTRA_SHORT: {
    horizon: 'ULTRA_SHORT',
    label: '초단기',
    intendedHoldingPeriod: 'minutes to 1 trading day',
    rebalanceCadence: 'continuous / intraday',
    primaryStrategyFamilies: ['microstructure', 'volume absorption', 'VWAP reclaim', 'breakout continuation', 'intraday mean reversion'],
    evidenceFreshness: 'minutes to hours',
    minimumIndependentConfirmations: 3,
    timeframeRules: [
      { timeframe: '1M', weight: 0.20, purpose: ['ENTRY'], required: false },
      { timeframe: '5M', weight: 0.25, purpose: ['ENTRY', 'RISK'], required: true },
      { timeframe: '15M', weight: 0.25, purpose: ['CONFIRMATION', 'STRUCTURE'], required: true },
      { timeframe: '1H', weight: 0.20, purpose: ['REGIME', 'STRUCTURE'], required: true },
      { timeframe: '4H', weight: 0.10, purpose: ['REGIME'], required: false },
    ],
    notes: ['Higher-timeframe conflict can block new risk even when minute signals are strong.'],
  },
  SHORT: {
    horizon: 'SHORT',
    label: '단기',
    intendedHoldingPeriod: '1 to 10 trading days',
    rebalanceCadence: 'daily / event-driven',
    primaryStrategyFamilies: ['trend momentum', 'volume expansion', 'swing breakout', 'event continuation', 'pullback entry'],
    evidenceFreshness: 'hours to days',
    minimumIndependentConfirmations: 4,
    timeframeRules: [
      { timeframe: '15M', weight: 0.10, purpose: ['ENTRY'], required: false },
      { timeframe: '1H', weight: 0.20, purpose: ['ENTRY', 'CONFIRMATION'], required: true },
      { timeframe: '4H', weight: 0.25, purpose: ['STRUCTURE', 'CONFIRMATION'], required: true },
      { timeframe: '1D', weight: 0.35, purpose: ['STRUCTURE', 'REGIME', 'RISK'], required: true },
      { timeframe: '1W', weight: 0.10, purpose: ['REGIME'], required: false },
    ],
    notes: ['Daily structure owns the trade thesis; intraday frames only refine entry and exit timing.'],
  },
  MEDIUM: {
    horizon: 'MEDIUM',
    label: '중기',
    intendedHoldingPeriod: '2 to 12 weeks',
    rebalanceCadence: 'weekly / catalyst-driven',
    primaryStrategyFamilies: ['sector relative strength', 'trend following', 'earnings revision', 'quality momentum', 'positioning unwind'],
    evidenceFreshness: 'days to weeks',
    minimumIndependentConfirmations: 4,
    timeframeRules: [
      { timeframe: '1H', weight: 0.05, purpose: ['ENTRY'], required: false },
      { timeframe: '4H', weight: 0.10, purpose: ['ENTRY', 'CONFIRMATION'], required: false },
      { timeframe: '1D', weight: 0.35, purpose: ['STRUCTURE', 'CONFIRMATION', 'RISK'], required: true },
      { timeframe: '1W', weight: 0.40, purpose: ['REGIME', 'STRUCTURE'], required: true },
      { timeframe: '1MO', weight: 0.10, purpose: ['REGIME'], required: false },
    ],
    notes: ['Weekly and daily disagreement reduces conviction rather than being averaged away.'],
  },
  MEDIUM_LONG: {
    horizon: 'MEDIUM_LONG',
    label: '중장기',
    intendedHoldingPeriod: '3 to 12 months',
    rebalanceCadence: 'monthly / thesis-change',
    primaryStrategyFamilies: ['fundamental momentum', 'sector cycle', 'valuation re-rating', 'capital expenditure cycle', 'policy transmission'],
    evidenceFreshness: 'weeks to months',
    minimumIndependentConfirmations: 5,
    timeframeRules: [
      { timeframe: '4H', weight: 0.05, purpose: ['ENTRY'], required: false },
      { timeframe: '1D', weight: 0.20, purpose: ['ENTRY', 'RISK'], required: true },
      { timeframe: '1W', weight: 0.45, purpose: ['STRUCTURE', 'REGIME', 'CONFIRMATION'], required: true },
      { timeframe: '1MO', weight: 0.30, purpose: ['REGIME', 'STRUCTURE'], required: true },
    ],
    notes: ['Lower timeframes may improve entry price but cannot overturn a broken weekly/monthly thesis.'],
  },
  LONG: {
    horizon: 'LONG',
    label: '장기',
    intendedHoldingPeriod: '12 months and longer',
    rebalanceCadence: 'quarterly / thesis-change',
    primaryStrategyFamilies: ['structural growth', 'cash-flow compounding', 'deep value', 'long-cycle capex', 'secular policy theme'],
    evidenceFreshness: 'months to quarters',
    minimumIndependentConfirmations: 5,
    timeframeRules: [
      { timeframe: '1D', weight: 0.10, purpose: ['ENTRY', 'RISK'], required: false },
      { timeframe: '1W', weight: 0.35, purpose: ['STRUCTURE', 'CONFIRMATION'], required: true },
      { timeframe: '1MO', weight: 0.55, purpose: ['REGIME', 'STRUCTURE', 'RISK'], required: true },
    ],
    notes: ['Long-horizon positions use independent thesis, stop logic, targets, and performance attribution.'],
  },
};

export const HORIZON_ORDER: TradingHorizon[] = ['ULTRA_SHORT', 'SHORT', 'MEDIUM', 'MEDIUM_LONG', 'LONG'];

export const requiredTimeframesForHorizon = (horizon: TradingHorizon) =>
  HORIZON_STRATEGY_POLICIES[horizon].timeframeRules.filter((rule) => rule.required).map((rule) => rule.timeframe);

export const horizonPolicy = (horizon: TradingHorizon) => HORIZON_STRATEGY_POLICIES[horizon];
