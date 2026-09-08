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
 * Keep the catalog deliberately small. Strategy Factory explores combinations
 * of economically distinct signal families instead of rewarding indicator count.
 */
export const INDICATOR_CATALOG: IndicatorDefinition[] = [
  { id: 'EMA_STACK', family: 'TREND', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['ADX_DMI'], purpose: 'Trend direction and persistence across EMA20/50/200.' },
  { id: 'RSI14', family: 'MOMENTUM', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['STOCH_RSI'], purpose: 'Momentum state and overbought/oversold context.' },
  { id: 'MACD_HISTOGRAM', family: 'MOMENTUM', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['ROC20'], purpose: 'Momentum acceleration/deceleration.' },
  { id: 'ROC20', family: 'MOMENTUM', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['MACD_HISTOGRAM'], purpose: 'Medium-horizon directional rate of change.' },
  { id: 'STOCH_RSI', family: 'MOMENTUM', status: 'ACTIVE', defaultEnabledForFactory: false, correlatedWith: ['RSI14'], purpose: 'Shorter-horizon momentum extreme; mainly useful for mean reversion.' },
  { id: 'ATR14', family: 'VOLATILITY', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['BOLLINGER_BANDWIDTH'], purpose: 'Volatility-normalized risk, stops and regime context.' },
  { id: 'BOLLINGER_PERCENT_B', family: 'LOCATION', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: ['RSI14', 'STOCH_RSI'], purpose: 'Location inside a volatility-adjusted price envelope.' },
  { id: 'BOLLINGER_BANDWIDTH', family: 'VOLATILITY', status: 'ACTIVE', defaultEnabledForFactory: false, correlatedWith: ['ATR14'], purpose: 'Volatility compression/expansion.' },
  { id: 'VOLUME_Z', family: 'FLOW', status: 'ACTIVE', defaultEnabledForFactory: true, correlatedWith: [], purpose: 'Abnormal participation/volume confirmation.' },
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
