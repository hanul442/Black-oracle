import type { TradingHorizon } from './horizonPolicy';

export const EQUITY_MIN_DAILY_VOLUME = 500_000;
export const EQUITY_MIN_MARKET_CAP_KRW = 100_000_000_000;

export interface EquityUniverseCandidate {
  market: string;
  symbol: string;
  name: string;
  sector: string | null;
  dailyVolume: number | null;
  marketCapKrw: number | null;
  cryptoLinked: boolean | null;
  cryptoLinkReasons?: string[];
  suspended?: boolean;
  warning?: boolean;
}

export interface EquityUniverseDecision {
  market: string;
  eligible: boolean;
  reasons: string[];
  dataGaps: string[];
}

/**
 * Hard pre-Council gate requested for KRX selection.
 * Missing market-cap or crypto-exposure classification is a DATA_GAP rather than an implicit pass.
 */
export const evaluateEquityUniverseCandidate = (candidate: EquityUniverseCandidate): EquityUniverseDecision => {
  const reasons: string[] = [];
  const dataGaps: string[] = [];
  let eligible = true;

  if (candidate.suspended) {
    eligible = false;
    reasons.push('Trading suspension flag is active.');
  }
  if (candidate.warning) {
    eligible = false;
    reasons.push('Market warning/risk flag is active.');
  }

  if (!Number.isFinite(candidate.dailyVolume)) {
    eligible = false;
    dataGaps.push('Daily volume is unavailable.');
  } else if ((candidate.dailyVolume ?? 0) < EQUITY_MIN_DAILY_VOLUME) {
    eligible = false;
    reasons.push(`Daily volume ${(candidate.dailyVolume ?? 0).toLocaleString()} is below the 500,000-share minimum.`);
  } else {
    reasons.push('Daily volume passes the 500,000-share minimum.');
  }

  if (!Number.isFinite(candidate.marketCapKrw)) {
    eligible = false;
    dataGaps.push('Market capitalization is unavailable.');
  } else if ((candidate.marketCapKrw ?? 0) < EQUITY_MIN_MARKET_CAP_KRW) {
    eligible = false;
    reasons.push(`Market capitalization is below ₩100B.`);
  } else {
    reasons.push('Market capitalization passes the ₩100B minimum.');
  }

  if (candidate.cryptoLinked == null) {
    eligible = false;
    dataGaps.push('Crypto-linked equity classification is unavailable.');
  } else if (candidate.cryptoLinked) {
    eligible = false;
    reasons.push(`Excluded as crypto-linked equity${candidate.cryptoLinkReasons?.length ? `: ${candidate.cryptoLinkReasons.join('; ')}` : '.'}`);
  } else {
    reasons.push('No crypto-linked equity exclusion is recorded.');
  }

  return { market: candidate.market, eligible, reasons, dataGaps };
};

export interface SectorStrengthInput {
  sector: string;
  horizon: TradingHorizon;
  relativeStrength: number;
  breadth: number;
  volumeParticipation: number;
  evidenceScore: number;
  earningsOrFundamentalMomentum?: number | null;
  riskPenalty?: number | null;
}

export interface SectorStrengthScore extends SectorStrengthInput {
  score: number;
  stance: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const scoreSectorStrength = (input: SectorStrengthInput): SectorStrengthScore => {
  const fundamental = Number.isFinite(input.earningsOrFundamentalMomentum) ? Number(input.earningsOrFundamentalMomentum) : 50;
  const riskPenalty = Number.isFinite(input.riskPenalty) ? Number(input.riskPenalty) : 0;
  const score = clamp(
    input.relativeStrength * 0.30
      + input.breadth * 0.22
      + input.volumeParticipation * 0.18
      + input.evidenceScore * 0.18
      + fundamental * 0.12
      - riskPenalty,
    0,
    100,
  );
  const stance = score >= 75 ? 'STRONG_BULLISH' : score >= 62 ? 'BULLISH' : score >= 45 ? 'NEUTRAL' : 'BEARISH';
  return { ...input, score, stance };
};
