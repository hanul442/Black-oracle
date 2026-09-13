import { scoreSectorStrength, type SectorStrengthScore } from './equityUniversePolicy';
import { buildMarketSectorRuntime, type MarketSectorRuntimeSnapshot } from './marketSectorRuntime';

export interface KrxIndexObservation {
  code: string;
  name: string;
  value: number;
  changeRate: number | null;
  turnoverKrw: number | null;
  previousTurnoverKrw: number | null;
  high: number | null;
  low: number | null;
  advancingIssues: number | null;
  flatIssues: number | null;
  decliningIssues: number | null;
}

export interface KrxEquitySectorObservation {
  market: string;
  sector: string | null;
  changeRate: number | null;
  volumeTurnoverRate: number | null;
  evidenceScore: number | null;
  evidenceCount: number;
  warning: boolean;
}

export interface KrxShortHorizonMarketSectorSnapshot {
  asOf: number;
  horizon: 'SHORT';
  marketRuntime: MarketSectorRuntimeSnapshot;
  sectorScores: Array<{
    sector: string;
    constituentCount: number;
    positiveCount: number;
    breadthPct: number;
    dataGaps: string[];
    score: SectorStrengthScore;
  }>;
  benchmarkChangeRate: number | null;
  sessionProgress: number;
  dataGaps: string[];
  sourceIds: string[];
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const krxSessionProgress = (asOf: number) => {
  const kst = new Date(asOf + 9 * 60 * 60_000);
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const open = 9 * 60;
  const close = 15 * 60 + 30;
  if (minutes <= open) return 0;
  if (minutes >= close) return 1;
  return clamp((minutes - open) / (close - open), 0, 1);
};

const changeToScore = (changeRate: number) => clamp(50 + changeRate * 1_000);
const evidenceToScore = (score: number) => clamp((score + 100) / 2);

const weightedBreadth = (indexes: KrxIndexObservation[]) => {
  let positive = 0;
  let total = 0;
  for (const index of indexes) {
    const up = Number(index.advancingIssues);
    const flat = Number(index.flatIssues);
    const down = Number(index.decliningIssues);
    if (![up, flat, down].every(Number.isFinite)) continue;
    positive += up + flat * 0.5;
    total += up + flat + down;
  }
  return total > 0 ? clamp(positive / total * 100) : null;
};

const turnoverParticipationScore = (indexes: KrxIndexObservation[], sessionProgress: number) => {
  const current = indexes.map((item) => item.turnoverKrw).filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
  const previous = indexes.map((item) => item.previousTurnoverKrw).filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
  if (!current.length || current.length !== previous.length || sessionProgress <= 0) return null;
  const currentSum = current.reduce((sum, value) => sum + value, 0);
  const previousSum = previous.reduce((sum, value) => sum + value, 0);
  if (previousSum <= 0) return null;
  const paceRatio = currentSum / previousSum / Math.max(0.15, sessionProgress);
  return clamp(paceRatio * 50);
};

const volatilitySupportScore = (indexes: KrxIndexObservation[]) => {
  const ranges = indexes.flatMap((item) => {
    if (!Number.isFinite(item.value) || !Number.isFinite(item.high) || !Number.isFinite(item.low) || item.value <= 0) return [];
    return [Math.max(0, Number(item.high) - Number(item.low)) / item.value];
  });
  const range = average(ranges);
  if (range == null) return null;
  // Lower intraday index range is treated as more supportive for new risk. This is a
  // transparent range-risk heuristic, not a realized-volatility estimate.
  return clamp(100 - range * 2_500);
};

const percentileScore = (value: number, sorted: number[]) => {
  if (!sorted.length || !Number.isFinite(value)) return 50;
  if (sorted.length === 1) return 50;
  let below = 0;
  let equal = 0;
  for (const item of sorted) {
    if (item < value) below += 1;
    else if (item === value) equal += 1;
  }
  return clamp((below + equal * 0.5) / sorted.length * 100);
};

export const buildKrxShortHorizonMarketSectorSnapshot = (input: {
  asOf: number;
  indexes: KrxIndexObservation[];
  equities: KrxEquitySectorObservation[];
  indexErrors?: string[];
}): KrxShortHorizonMarketSectorSnapshot => {
  const sessionProgress = krxSessionProgress(input.asOf);
  const dataGaps = (input.indexErrors ?? []).map((item) => `Index DATA_GAP: ${item}`);
  const validIndexChanges = input.indexes.map((item) => item.changeRate).filter((value): value is number => value != null && Number.isFinite(value));
  const benchmarkChangeRate = average(validIndexChanges);
  const indexTrendScore = benchmarkChangeRate == null ? 50 : changeToScore(benchmarkChangeRate);
  if (benchmarkChangeRate == null) dataGaps.push('Index DATA_GAP: KOSPI/KOSDAQ change-rate coverage is unavailable; neutral trend score used.');

  const breadthScore = weightedBreadth(input.indexes);
  if (breadthScore == null) dataGaps.push('Index DATA_GAP: KRX advance/flat/decline breadth counts are unavailable; neutral breadth score used.');

  const turnoverScore = turnoverParticipationScore(input.indexes, sessionProgress);
  if (turnoverScore == null) dataGaps.push('Index DATA_GAP: current/prior KRX turnover pace is unavailable; neutral turnover score used.');

  const volatilityScore = volatilitySupportScore(input.indexes);
  if (volatilityScore == null) dataGaps.push('Index DATA_GAP: intraday KRX index high/low range is unavailable; neutral volatility score used.');

  const evidenceScores = input.equities
    .filter((item) => item.evidenceCount > 0 && item.evidenceScore != null && Number.isFinite(item.evidenceScore))
    .map((item) => evidenceToScore(Number(item.evidenceScore)));
  const evidenceScore = average(evidenceScores);
  if (evidenceScore == null) dataGaps.push('Evidence DATA_GAP: no active source-backed KRX equity Evidence is represented in this market sample; neutral evidence score used.');

  const volumeRates = input.equities
    .map((item) => item.volumeTurnoverRate)
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((a, b) => a - b);
  const benchmark = benchmarkChangeRate ?? 0;
  const sectorObservations = input.equities.flatMap((item) => {
    const sector = String(item.sector ?? '').trim();
    if (!sector || item.changeRate == null || !Number.isFinite(item.changeRate)) return [];
    const localGaps: string[] = [];
    if (item.volumeTurnoverRate == null || !Number.isFinite(item.volumeTurnoverRate)) localGaps.push(`${item.market}: volume-turnover percentile is unavailable; neutral participation score used.`);
    if (item.evidenceCount <= 0) localGaps.push(`${item.market}: no active source-backed Evidence score.`);
    return [{
      market: item.market,
      sector,
      horizon: 'SHORT' as const,
      relativeStrengthScore: clamp(50 + (item.changeRate - benchmark) * 1_000),
      volumeParticipationScore: item.volumeTurnoverRate == null ? 50 : percentileScore(item.volumeTurnoverRate, volumeRates),
      positive: item.changeRate > 0,
      evidenceScore: item.evidenceCount > 0 && item.evidenceScore != null ? evidenceToScore(item.evidenceScore) : null,
      fundamentalMomentumScore: null,
      riskPenalty: item.warning ? 20 : 0,
      localGaps,
    }];
  });

  const marketRuntime = buildMarketSectorRuntime({
    marketStates: [{
      horizon: 'SHORT',
      asOf: input.asOf,
      indexTrendScore,
      breadthScore: breadthScore ?? 50,
      turnoverScore: turnoverScore ?? 50,
      volatilityScore: volatilityScore ?? 50,
      evidenceScore: evidenceScore ?? 50,
      sourceIds: input.indexes.map((item) => `KIS:FHPUP02100000:${item.code}`),
      dataGaps: unique(dataGaps),
    }],
    sectorObservations: sectorObservations.map(({ localGaps: _localGaps, ...observation }) => observation),
  });

  const localSectorGaps = new Map<string, string[]>();
  for (const item of sectorObservations) {
    const list = localSectorGaps.get(item.sector) ?? [];
    list.push(...item.localGaps);
    localSectorGaps.set(item.sector, list);
  }
  for (const packet of marketRuntime.sectorPackets) {
    packet.dataGaps.push(...unique(localSectorGaps.get(packet.sector) ?? []));
  }

  const sectorScores = marketRuntime.sectorPackets
    .map((packet) => ({
      sector: packet.sector,
      constituentCount: packet.constituentCount,
      positiveCount: packet.positiveCount,
      breadthPct: packet.breadthPct,
      dataGaps: unique(packet.dataGaps),
      score: scoreSectorStrength(packet.input),
    }))
    .sort((a, b) => b.score.score - a.score.score || b.constituentCount - a.constituentCount || a.sector.localeCompare(b.sector));

  if (!sectorScores.length) dataGaps.push('Sector DATA_GAP: no KIS sector-tagged equity observation was available for SHORT-horizon ranking.');

  return {
    asOf: input.asOf,
    horizon: 'SHORT',
    marketRuntime,
    sectorScores,
    benchmarkChangeRate,
    sessionProgress,
    dataGaps: unique(dataGaps),
    sourceIds: input.indexes.map((item) => `KIS:FHPUP02100000:${item.code}`),
  };
};