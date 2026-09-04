import type { EvidenceAggregate } from './evidence';

export type EvidenceForecastDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNAVAILABLE';

export interface EvidenceForecast {
  available: boolean;
  direction: EvidenceForecastDirection;
  probabilityBullish: number | null;
  probabilityBearish: number | null;
  confidence: number;
  uncertainty: number;
  score: number | null;
  asOf: number;
  evidenceIds: string[];
  activeCount: number;
  contradictionCount: number;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export const buildEvidenceForecast = (aggregate: EvidenceAggregate): EvidenceForecast => {
  if (aggregate.activeCount === 0) {
    return {
      available: false,
      direction: 'UNAVAILABLE',
      probabilityBullish: null,
      probabilityBearish: null,
      confidence: 0,
      uncertainty: 1,
      score: null,
      asOf: aggregate.asOf,
      evidenceIds: [],
      activeCount: 0,
      contradictionCount: 0,
      reasons: ['No active structured evidence is available, so no event forecast is asserted.'],
    };
  }

  const contradictionRatio = aggregate.contradictionCount / Math.max(1, aggregate.activeCount);
  const contradictionPenalty = clamp(1 - contradictionRatio * 0.35, 0.65, 1);
  const confidence = clamp(aggregate.confidence * contradictionPenalty, 0, 0.95);
  const directionalSignal = clamp(aggregate.score / 100, -1, 1);
  const probabilityBullish = clamp(0.5 + directionalSignal * confidence * 0.5, 0.05, 0.95);
  const probabilityBearish = 1 - probabilityBullish;

  const direction: EvidenceForecastDirection = probabilityBullish >= 0.58
    ? 'BULLISH'
    : probabilityBullish <= 0.42
      ? 'BEARISH'
      : 'NEUTRAL';

  const reasons = [
    `Evidence score ${aggregate.score} is shrunk toward 50/50 by confidence ${confidence.toFixed(2)}.`,
    `${aggregate.activeCount} active evidence item(s) support this forecast contract.`,
  ];
  if (aggregate.contradictionCount > 0) {
    reasons.push(`${aggregate.contradictionCount} contradiction link(s) increase forecast uncertainty.`);
  }

  return {
    available: true,
    direction,
    probabilityBullish: round3(probabilityBullish),
    probabilityBearish: round3(probabilityBearish),
    confidence: round3(confidence),
    uncertainty: round3(1 - confidence),
    score: aggregate.score,
    asOf: aggregate.asOf,
    evidenceIds: aggregate.evidenceIds.slice(),
    activeCount: aggregate.activeCount,
    contradictionCount: aggregate.contradictionCount,
    reasons,
  };
};