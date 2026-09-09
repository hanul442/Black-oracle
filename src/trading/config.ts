import type { RiskLimits } from './types';

export const TRADING_STRATEGY_VERSION = 'BO-UNIFIED-v0.2.0';
export const UNIFIED_PAPER_INITIAL_EQUITY_KRW = 100_000_000;

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  // Position sizing now targets 10% equal notional with a 15% hard cap;
  // stop-distance risk is capped separately in positionSizing.ts.
  maxPositionPct: 0.15,
  maxDailyLossPct: 0.01,
  maxTotalDrawdownPct: 0.05,
  maxEstimatedSlippageBps: 30,
  maxMarketDataAgeMs: 90_000,
};

export const SUPPORTED_UPBIT_MINUTE_UNITS = [1, 3, 5, 10, 15, 30, 60, 240] as const;
export type SupportedUpbitMinuteUnit = (typeof SUPPORTED_UPBIT_MINUTE_UNITS)[number];
