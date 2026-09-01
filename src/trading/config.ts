import type { RiskLimits } from './types';

export const TRADING_STRATEGY_VERSION = 'BO-CRYPTO-v0.1.3';

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionPct: 0.02,
  maxDailyLossPct: 0.01,
  maxTotalDrawdownPct: 0.05,
  maxEstimatedSlippageBps: 30,
  maxMarketDataAgeMs: 90_000,
};

export const SUPPORTED_UPBIT_MINUTE_UNITS = [1, 3, 5, 10, 15, 30, 60, 240] as const;
export type SupportedUpbitMinuteUnit = (typeof SUPPORTED_UPBIT_MINUTE_UNITS)[number];
