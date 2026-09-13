import { EquityExposureRegistry } from '../../../src/trading/equityExposureRegistry';
import { buildKrxShortHorizonMarketSectorSnapshot, type KrxShortHorizonMarketSectorSnapshot } from '../../../src/trading/krxMarketSectorObservation';
import { tradingEvidenceStore } from '../evidenceStore';
import { KrxOfficialEodMarketData } from './krxOfficialEodMarketData';
import { buildKrxUniversePacket, type KrxUniversePacket } from './krxUniverseBuilder';

export interface KrxCommitteeCandidate {
  market: string;
  symbol: string;
  name: string;
  sector: string;
  horizon: 'SHORT';
  rank: number;
  score: number;
  sectorScore: number;
  changeRate: number | null;
  dailyVolume: number | null;
  marketCapKrw: number | null;
  evidenceScore: number;
  evidenceCount: number;
  evidenceIds: string[];
  hardGateEligible: boolean;
  nominationReady: boolean;
  blockers: string[];
}

export interface KrxShadowResearchCycleResult {
  startedAt: number;
  finishedAt: number;
  tradingDate: string;
  source: 'KRX_OFFICIAL_EOD';
  mode: 'SHADOW';
  executionAuthority: false;
  universe: KrxUniversePacket;
  marketSector: KrxShortHorizonMarketSectorSnapshot;
  committeeCandidates: KrxCommitteeCandidate[];
  nominationReadyCount: number;
  blockers: string[];
  sourceIds: string[];
}

const exposureRegistry = new EquityExposureRegistry();
export const krxEquityExposureRegistry = exposureRegistry;

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const blockingReasons = (reasons: string[]) => reasons.filter((reason) => /below|excluded|suspension|warning|blocked|unavailable/i.test(reason));

export const runKrxShadowResearchCycle = async (): Promise<KrxShadowResearchCycleResult> => {
  const startedAt = Date.now();
  const marketData = new KrxOfficialEodMarketData();
  const snapshot = await marketData.snapshot();
  const universe = await buildKrxUniversePacket(marketData, exposureRegistry, {
    discoveryLimit: 100,
    maxProfiles: 60,
    profileDelayMs: 0,
    asOf: snapshot.asOf,
  });

  const equityObservations = universe.rows.map((row) => {
    const evidence = tradingEvidenceStore.aggregate(row.candidate.market);
    return {
      market: row.candidate.market,
      sector: row.candidate.sector,
      changeRate: row.changeRate,
      volumeTurnoverRate: row.profile.volumeTurnoverRate,
      evidenceScore: evidence.activeCount > 0 ? evidence.score : null,
      evidenceCount: evidence.activeCount,
      warning: row.candidate.warning === true,
    };
  });

  const marketSector = buildKrxShortHorizonMarketSectorSnapshot({
    asOf: snapshot.asOf,
    indexes: snapshot.indexObservations,
    equities: equityObservations,
    sourceIds: snapshot.sourceIds,
    indexErrors: [
      'Official KRX EOD fallback has no paired prior-turnover index observation; turnover pace stays neutral.',
      'Official KRX EOD fallback has no intraday index high/low observation; range-risk support stays neutral.',
    ],
  });

  const strongSectorScore = new Map(
    marketSector.sectorScores
      .filter((item) => item.score.score >= 62)
      .map((item) => [item.sector, item.score.score] as const),
  );

  const committeeCandidates = universe.rows.flatMap((row) => {
    const sector = String(row.candidate.sector ?? '').trim();
    const sectorScore = strongSectorScore.get(sector);
    if (!sector || sectorScore == null) return [];
    const evidence = tradingEvidenceStore.aggregate(row.candidate.market);
    const volumeRankScore = universe.profiled <= 1 ? 50 : clamp(100 - (row.rank - 1) / Math.max(1, universe.profiled - 1) * 100);
    const returnScore = row.changeRate == null ? 50 : clamp(50 + row.changeRate * 1_000);
    const evidenceScore = evidence.activeCount > 0 ? clamp((evidence.score + 100) / 2) : 50;
    const score = clamp(sectorScore * 0.40 + returnScore * 0.25 + volumeRankScore * 0.20 + evidenceScore * 0.15);
    const blockers = unique([
      ...row.decision.dataGaps,
      ...(row.decision.eligible ? [] : blockingReasons(row.decision.reasons)),
      ...row.dataErrors,
    ]);
    return [{
      market: row.candidate.market,
      symbol: row.candidate.symbol,
      name: row.candidate.name,
      sector,
      horizon: 'SHORT' as const,
      rank: 0,
      score,
      sectorScore,
      changeRate: row.changeRate,
      dailyVolume: row.candidate.dailyVolume,
      marketCapKrw: row.candidate.marketCapKrw,
      evidenceScore: evidence.score,
      evidenceCount: evidence.activeCount,
      evidenceIds: evidence.evidenceIds.slice(),
      hardGateEligible: row.decision.eligible,
      nominationReady: row.decision.eligible,
      blockers,
    }];
  })
    .sort((a, b) => b.score - a.score || Number(b.dailyVolume ?? 0) - Number(a.dailyVolume ?? 0))
    .slice(0, 50)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const nominationReadyCount = committeeCandidates.filter((item) => item.nominationReady).length;
  const blockers = unique([
    ...marketSector.dataGaps,
    ...(committeeCandidates.length ? [] : ['No strong-sector KRX research candidate was available for the Committee pool.']),
    ...(nominationReadyCount > 0 ? [] : ['Committee candidate pool is live, but no stock is nomination-ready because one or more Hard Universe gates remain unresolved.']),
    ...(universe.rows.some((row) => row.exposure.status === 'UNKNOWN')
      ? ['Crypto-linked equity classification is UNKNOWN for one or more candidates; source-backed exposure classification is required before nomination.']
      : []),
  ]);

  return {
    startedAt,
    finishedAt: Date.now(),
    tradingDate: snapshot.tradingDate,
    source: 'KRX_OFFICIAL_EOD',
    mode: 'SHADOW',
    executionAuthority: false,
    universe,
    marketSector,
    committeeCandidates,
    nominationReadyCount,
    blockers,
    sourceIds: snapshot.sourceIds.slice(),
  };
};
