import type { RiskLimits } from './types';

export const TRADING_STRATEGY_VERSION = 'BO-UNIFIED-v0.3.0';
export const UNIFIED_PAPER_INITIAL_EQUITY_KRW = 100_000_000;

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  // Capital stays bounded, but protection is defined per trade from structure + ATR.
  maxPositionPct: 0.15,
  maxRiskPerTradePct: 0.005,
  // Daily loss is no longer an immediate binary stop at -1%.
  // New risk is progressively throttled from -1% and only hard-stops at -3%.
  dailyLossThrottleStartPct: 0.01,
  maxDailyLossPct: 0.03,
  minDailyLossNotionalScale: 0.25,
  maxTotalDrawdownPct: 0.05,
  maxEstimatedSlippageBps: 30,
  maxMarketDataAgeMs: 90_000,
};

export const SUPPORTED_UPBIT_MINUTE_UNITS = [1, 3, 5, 10, 15, 30, 60, 240] as const;
export type SupportedUpbitMinuteUnit = (typeof SUPPORTED_UPBIT_MINUTE_UNITS)[number];
