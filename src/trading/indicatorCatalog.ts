export type IndicatorFamily = 'TREND' | 'MOMENTUM' | 'VOLATILITY' | 'LOCATION' | 'STRUCTURE' | 'FLOW';
export type IndicatorStatus = 'ACTIVE' | 'CHALLENGER' | 'PLANNED';

export interface IndicatorDefinition {
  id: string;
  family: IndicatorFamily;
  status: IndicatorStatus;
  defaultEnabledForFactory: boolean;
  correlatedWith: string[];
  purpose: string;
}

/**
 * The Factory should combine economically distinct directional signals, not every
 * available calculation. ATR and raw volume remain important for risk/confirmation
 * but are not treated as independent bullish/bearish votes by default.
 */
export const INDICATOR_CATALOG: IndicatorDefinition[] = [
  { id: 'EMA_STACK', family: 'TREND', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['ADX_DMI'], purpose: 'Trend direction and persistence across EMA20/50/200.' },
  { id: 'RSI14', family: 'MOMENTUM', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['STOCH_RSI'], purpose: 'Momentum state; Factory may test continuation or mean-reversion polarity.' },
  { id: 'MACD_HISTOGRAM', family: 'MOMENTUM', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['ROC20'], purpose: 'Momentum acceleration/deceleration.' },
  { id: 'ROC20', family: 'MOMENTUM', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['MACD_HISTOGRAM'], purpose: 'Medium-horizon directional rate of change.' },
  { id: 'STOCH_RSI', family: 'MOMENTUM', status: 'ACTIVE', defaultEnabledForFactory: false, correlatedWith: ['RSI14'], purpose: 'Shorter-horizon momentum extreme; optional mean-reversion challenger.' },
  { id: 'ATR14', family: 'VOLATILITY', status: 'ACTIVE', defaultEnabledForFactory: false, correlatedWith: ['BOLLINGER_BANDWIDTH'], purpose: 'Risk sizing, stops and volatility regime; not a directional vote by default.' },
  { id: 'BOLLINGER_PERCENT_B', family: 'LOCATION', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['RSI14', 'STOCH_RSI'], purpose: 'Location inside a volatility-adjusted envelope; continuation/reversion polarity can be tested.' },
  { id: 'BOLLINGER_BANDWIDTH', family: 'VOLATILITY', status: 'ACTIVE', defaultEnabledForFactory: false, correlatedWith: ['ATR14'], purpose: 'Volatility compression/expansion filter rather than default directional vote.' },
  { id: 'VOLUME_Z', family: 'FLOW', status: 'ACTIVE', defaultEnabledForFactory: false, correlatedWith: ['MICROSTRUCTURE'], purpose: 'Participation confirmation; used as a modifier rather than standalone direction.' },
  { id: 'MARKET_STRUCTURE', family: 'STRUCTURE', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['WAVE_STRUCTURE'], purpose: 'Swing structure, BOS/CHOCH, liquidity sweep and premium/discount location.' },
  { id: 'WAVE_STRUCTURE', family: 'STRUCTURE', status: 'CHALLENGER', defaultEnabledForFactory: true, correlatedWith: ['MARKET_STRUCTURE'], purpose: 'Confirmed swing-wave impulse/correction and Fibonacci retracement/extension.' },
  { id: 'MICROSTRUCTURE', family: 'FLOW', status: 'CHALLENGER', defaultEnabledForFactory: false, correlatedWith: ['VOLUME_Z'], purpose: 'Taker flow, order-book imbalance and volume-profile entry timing.' },
  { id: 'ADX_DMI', family: 'TREND', status: 'PLANNED', defaultEnabledForFactory: false, correlatedWith: ['EMA_STACK'], purpose: 'Independent trend-strength challenger.' },
  { id: 'VWAP', family: 'LOCATION', status: 'PLANNED', defaultEnabledForFactory: false, correlatedWith: ['ANCHORED_VWAP'], purpose: 'Volume-weighted fair-price/location context.' },
  { id: 'ANCHORED_VWAP', family: 'LOCATION', status: 'PLANNED', defaultEnabledForFactory: false, correlatedWith: ['VWAP'], purpose: 'Event/swing-anchored fair-price and pullback location.' },
  { id: 'OPEN_INTEREST', family: 'FLOW', status: 'PLANNED', defaultEnabledForFactory: false, correlatedWith: ['FUNDING_RATE'], purpose: 'Crypto derivatives positioning and leverage build-up.' },
  { id: 'FUNDING_RATE', family: 'FLOW', status: 'PLANNED', defaultEnabledForFactory: false, correlatedWith: ['OPEN_INTEREST'], purpose: 'Crowded long/short positioning context.' },
];

export const factoryEligibleIndicators = () => INDICATOR_CATALOG.filter((item) => item.defaultEnabledForFactory && item.status !== 'PLANNED');
