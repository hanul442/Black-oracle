export type PositionSizingMode = 'EQUAL_NOTIONAL_RISK_CAPPED' | 'FIXED_RISK_AT_STOP';

export interface PositionSizingInput {
  equity: number;
  cash: number;
  stopDistancePct: number;
  mode?: PositionSizingMode;
  targetNotionalPct?: number;
  maxNotionalPct?: number;
  maxRiskPerTradePct?: number;
}

export interface PositionSizingDecision {
  mode: PositionSizingMode;
  requestedNotional: number;
  targetNotional: number;
  maxNotional: number;
  riskBudget: number;
  expectedLossAtStop: number;
  expectedLossAtStopPct: number;
  confidenceScaled: false;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Capital sizing is deliberately decoupled from model confidence.
 * Baseline: equal target notional, reduced only when stop-distance risk or cash limits demand it.
 */
export const buildPositionSizingDecision = (input: PositionSizingInput): PositionSizingDecision => {
  if (!(input.equity > 0) || !(input.cash >= 0)) throw new Error('Position sizing requires positive equity and non-negative cash.');
  if (!(input.stopDistancePct > 0)) throw new Error('Position sizing requires a positive stop distance.');

  const mode = input.mode ?? 'EQUAL_NOTIONAL_RISK_CAPPED';
  const targetNotionalPct = clamp(input.targetNotionalPct ?? 0.10, 0.01, 0.25);
  const maxNotionalPct = clamp(input.maxNotionalPct ?? 0.15, targetNotionalPct, 0.30);
  const maxRiskPerTradePct = clamp(input.maxRiskPerTradePct ?? 0.005, 0.001, 0.02);
  const targetNotional = input.equity * targetNotionalPct;
  const maxNotional = Math.min(input.cash, input.equity * maxNotionalPct);
  const riskBudget = input.equity * maxRiskPerTradePct;
  const riskSizedNotional = riskBudget / input.stopDistancePct;

  const requestedNotional = mode === 'FIXED_RISK_AT_STOP'
    ? Math.min(maxNotional, riskSizedNotional)
    : Math.min(targetNotional, maxNotional, riskSizedNotional);

  const expectedLossAtStop = requestedNotional * input.stopDistancePct;
  return {
    mode,
    requestedNotional,
    targetNotional,
    maxNotional,
    riskBudget,
    expectedLossAtStop,
    expectedLossAtStopPct: expectedLossAtStop / input.equity,
    confidenceScaled: false,
    reasons: [
      `Target notional is ${(targetNotionalPct * 100).toFixed(1)}% of current equity; model confidence does not scale capital directly.`,
      `Loss at the planned stop is capped near ${(maxRiskPerTradePct * 100).toFixed(2)}% of equity before fees/slippage.`,
      mode === 'EQUAL_NOTIONAL_RISK_CAPPED'
        ? 'Equal-notional is the qualification baseline; only stop-risk, exposure and cash limits reduce size.'
        : 'Fixed-risk-at-stop is an experimental challenger and sizes notional inversely to stop distance.',
    ],
  };
};
