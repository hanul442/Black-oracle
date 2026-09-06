import type { MultiTimeframeSnapshot } from './types';
import type { MicrostructureSnapshot } from './microstructure';

export type MicrostructureAlignment = 'SUPPORTS' | 'CONFLICTS' | 'NEUTRAL' | 'UNAVAILABLE';

export interface MicrostructureChallengerSnapshot {
  available: boolean;
  baselineAction: MultiTimeframeSnapshot['action'];
  baselineOracleScore: number;
  alignment: MicrostructureAlignment;
  pressureScore: number | null;
  shadowScoreAdjustment: number;
  shadowOracleScore: number;
  confidence: number;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const buildMicrostructureChallenger = (
  multiTimeframe: MultiTimeframeSnapshot,
  microstructure: MicrostructureSnapshot,
): MicrostructureChallengerSnapshot => {
  if (!microstructure.available || microstructure.pressureScore == null) {
    return {
      available: false,
      baselineAction: multiTimeframe.action,
      baselineOracleScore: multiTimeframe.oracleTradeScore,
      alignment: 'UNAVAILABLE',
      pressureScore: null,
      shadowScoreAdjustment: 0,
      shadowOracleScore: multiTimeframe.oracleTradeScore,
      confidence: 0,
      reasons: ['Microstructure challenger is unavailable; baseline decision remains untouched.'],
    };
  }

  const pressure = microstructure.pressureScore;
  const materialDirection = Math.abs(pressure) >= 20 ? Math.sign(pressure) : 0;
  const baselineDirection = multiTimeframe.action === 'BUY' ? 1 : multiTimeframe.action === 'SELL' ? -1 : 0;
  const alignment: MicrostructureAlignment = materialDirection === 0 || baselineDirection === 0
    ? 'NEUTRAL'
    : materialDirection === baselineDirection
      ? 'SUPPORTS'
      : 'CONFLICTS';

  // ±12 points is an intentionally bounded shadow-only adjustment. It exists so we can
  // measure whether microstructure would have improved ranking without changing execution.
  const rawAdjustment = pressure * 0.12 * microstructure.confidence;
  const shadowScoreAdjustment = Math.round(clamp(rawAdjustment, -12, 12) * 10) / 10;
  const shadowOracleScore = Math.round(clamp(multiTimeframe.oracleTradeScore + shadowScoreAdjustment, 0, 100) * 10) / 10;

  return {
    available: true,
    baselineAction: multiTimeframe.action,
    baselineOracleScore: multiTimeframe.oracleTradeScore,
    alignment,
    pressureScore: pressure,
    shadowScoreAdjustment,
    shadowOracleScore,
    confidence: microstructure.confidence,
    reasons: [
      `Baseline ${multiTimeframe.action} score ${multiTimeframe.oracleTradeScore} is preserved for execution.`,
      `Microstructure pressure ${pressure} produces a bounded shadow adjustment of ${shadowScoreAdjustment >= 0 ? '+' : ''}${shadowScoreAdjustment}.`,
      `Shadow alignment is ${alignment}; this field is persisted for later closed-trade calibration only.`,
    ],
  };
};
