import type { Candle } from './types';

export type WaveDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type WavePhase = 'IMPULSE' | 'CORRECTION' | 'UNRESOLVED';
export type FibonacciZone = 'SHALLOW' | 'PREFERRED' | 'DEEP' | 'EXTENDED' | 'NONE';

export interface WavePivot {
  index: number;
  timestamp: number;
  price: number;
  type: 'HIGH' | 'LOW';
}

export interface WaveTheorySnapshot {
  direction: WaveDirection;
  phase: WavePhase;
  confidence: number;
  score: number;
  pivots: WavePivot[];
  alternatingLegs: number;
  retracementRatio: number | null;
  extensionRatio: number | null;
  fibonacciZone: FibonacciZone;
  impulseCandidate: boolean;
  correctionCandidate: boolean;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const detectPivots = (candles: Candle[], radius = 3): WavePivot[] => {
  if (candles.length < radius * 2 + 3) return [];
  const raw: WavePivot[] = [];
  for (let index = radius; index < candles.length - radius; index += 1) {
    const candle = candles[index];
    const window = candles.slice(index - radius, index + radius + 1);
    const isHigh = window.every((item, offset) => offset === radius || candle.high >= item.high);
    const isLow = window.every((item, offset) => offset === radius || candle.low <= item.low);
    if (isHigh && !isLow) raw.push({ index, timestamp: candle.timestamp, price: candle.high, type: 'HIGH' });
    if (isLow && !isHigh) raw.push({ index, timestamp: candle.timestamp, price: candle.low, type: 'LOW' });
  }

  const alternating: WavePivot[] = [];
  for (const pivot of raw) {
    const previous = alternating[alternating.length - 1];
    if (!previous || previous.type !== pivot.type) {
      alternating.push(pivot);
      continue;
    }
    const moreExtreme = pivot.type === 'HIGH' ? pivot.price > previous.price : pivot.price < previous.price;
    if (moreExtreme) alternating[alternating.length - 1] = pivot;
  }
  return alternating.slice(-8);
};

const fibZone = (ratio: number | null): FibonacciZone => {
  if (ratio == null || !Number.isFinite(ratio) || ratio < 0) return 'NONE';
  if (ratio < 0.382) return 'SHALLOW';
  if (ratio <= 0.618) return 'PREFERRED';
  if (ratio <= 0.786) return 'DEEP';
  return 'EXTENDED';
};

export const buildWaveTheorySnapshot = (candles: Candle[]): WaveTheorySnapshot => {
  const pivots = detectPivots(candles);
  const reasons: string[] = [];
  if (pivots.length < 4) {
    return {
      direction: 'NEUTRAL',
      phase: 'UNRESOLVED',
      confidence: 0,
      score: 0,
      pivots,
      alternatingLegs: Math.max(0, pivots.length - 1),
      retracementRatio: null,
      extensionRatio: null,
      fibonacciZone: 'NONE',
      impulseCandidate: false,
      correctionCandidate: false,
      reasons: ['Not enough confirmed alternating pivots to classify a wave structure.'],
    };
  }

  const recent = pivots.slice(-5);
  const [p0, p1, p2, p3, p4] = recent.length === 5 ? recent : [undefined, ...recent] as Array<WavePivot | undefined>;
  const latest = pivots[pivots.length - 1];
  const previous = pivots[pivots.length - 2];
  const prior = pivots[pivots.length - 3];

  let direction: WaveDirection = 'NEUTRAL';
  const highs = pivots.filter((item) => item.type === 'HIGH').slice(-3);
  const lows = pivots.filter((item) => item.type === 'LOW').slice(-3);
  const higherHighs = highs.length >= 2 && highs[highs.length - 1].price > highs[highs.length - 2].price;
  const higherLows = lows.length >= 2 && lows[lows.length - 1].price > lows[lows.length - 2].price;
  const lowerHighs = highs.length >= 2 && highs[highs.length - 1].price < highs[highs.length - 2].price;
  const lowerLows = lows.length >= 2 && lows[lows.length - 1].price < lows[lows.length - 2].price;
  if (higherHighs && higherLows) direction = 'BULLISH';
  else if (lowerHighs && lowerLows) direction = 'BEARISH';

  const impulseMove = prior && previous ? Math.abs(previous.price - prior.price) : 0;
  const correctionMove = previous && latest ? Math.abs(latest.price - previous.price) : 0;
  const retracementRatio = impulseMove > 0 ? correctionMove / impulseMove : null;

  let extensionRatio: number | null = null;
  if (p0 && p1 && p2 && p3 && p4) {
    const firstImpulse = Math.abs(p1.price - p0.price);
    const laterImpulse = Math.abs(p3.price - p2.price);
    if (firstImpulse > 0) extensionRatio = laterImpulse / firstImpulse;
  }

  const lastLegDirection = latest.price > previous.price ? 'UP' : 'DOWN';
  const impulseCandidate = (direction === 'BULLISH' && lastLegDirection === 'UP') || (direction === 'BEARISH' && lastLegDirection === 'DOWN');
  const correctionCandidate = direction !== 'NEUTRAL' && !impulseCandidate;
  const phase: WavePhase = impulseCandidate ? 'IMPULSE' : correctionCandidate ? 'CORRECTION' : 'UNRESOLVED';
  const zone = fibZone(retracementRatio);

  let score = direction === 'BULLISH' ? 45 : direction === 'BEARISH' ? -45 : 0;
  if (impulseCandidate) score += direction === 'BULLISH' ? 20 : direction === 'BEARISH' ? -20 : 0;
  if (correctionCandidate && zone === 'PREFERRED') score += direction === 'BULLISH' ? 12 : direction === 'BEARISH' ? -12 : 0;
  if (correctionCandidate && zone === 'EXTENDED') score *= 0.45;
  if (extensionRatio != null && extensionRatio >= 1.0 && extensionRatio <= 1.8) score *= 1.08;
  score = clamp(score, -100, 100);

  const confidence = clamp(
    0.25
      + Math.min(0.3, Math.max(0, pivots.length - 3) * 0.06)
      + (direction === 'NEUTRAL' ? 0 : 0.18)
      + (zone === 'PREFERRED' ? 0.12 : zone === 'DEEP' ? 0.05 : 0),
    0,
    0.9,
  );

  reasons.push(`${pivots.length} alternating swing pivots were detected without future-data access beyond pivot confirmation.`);
  if (direction !== 'NEUTRAL') reasons.push(`${direction} wave structure is supported by successive swing progression.`);
  if (retracementRatio != null) reasons.push(`Latest retracement is ${(retracementRatio * 100).toFixed(1)}% of the preceding leg (${zone}).`);
  if (extensionRatio != null) reasons.push(`Recent impulse extension is ${extensionRatio.toFixed(2)}x the earlier impulse leg.`);
  reasons.push('Wave theory is treated as a technical feature/challenger, not as deterministic Elliott-wave truth or execution authority.');

  return {
    direction,
    phase,
    confidence,
    score,
    pivots,
    alternatingLegs: Math.max(0, pivots.length - 1),
    retracementRatio,
    extensionRatio,
    fibonacciZone: zone,
    impulseCandidate,
    correctionCandidate,
    reasons,
  };
};
