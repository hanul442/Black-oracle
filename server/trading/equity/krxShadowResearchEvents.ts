import type { CanonicalEventInput } from '../../eventLedger';
import type { KrxShadowResearchCycleResult } from './krxShadowResearchLoop';

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const buildKrxShadowResearchCanonicalEvents = (
  cycle: KrxShadowResearchCycleResult,
  runtimeId: string,
): CanonicalEventInput[] => {
  const timestamp = cycle.marketSector.asOf;
  const prefix = `${runtimeId}:KRX:${cycle.tradingDate}:account-free`;
  const events: CanonicalEventInput[] = [{
    eventKey: `${prefix}:cycle`,
    occurredAt: timestamp,
    runtimeId,
    eventType: 'SYSTEM',
    eventName: 'V10_KRX_ACCOUNT_FREE_RESEARCH_CYCLE',
    market: 'KRX',
    action: cycle.blockers.length ? 'DEGRADED' : 'OBSERVED',
    summary: `Account-free KRX shadow cycle: ${cycle.universe.discovered} discovered, ${cycle.universe.profiled} profiled, ${cycle.committeeCandidates.length} Committee-pool candidate(s), ${cycle.nominationReadyCount} nomination-ready.`,
    reason: cycle.blockers[0] ?? 'Official KRX EOD research cycle completed without execution authority.',
    severity: cycle.blockers.length ? 'WARN' : 'INFO',
    authority: 'research_shadow',
    executionAuthority: false,
    source: 'krx_official_eod',
    trace: {
      tradingDate: cycle.tradingDate,
      source: cycle.source,
      discovered: cycle.universe.discovered,
      volumePrefiltered: cycle.universe.volumePrefiltered,
      profiled: cycle.universe.profiled,
      eligible: cycle.universe.eligible,
      candidatePool: cycle.committeeCandidates.length,
      nominationReadyCount: cycle.nominationReadyCount,
      blockers: cycle.blockers,
      sourceIds: cycle.sourceIds,
    },
    links: { sourceIds: cycle.sourceIds },
  }];

  for (const state of Object.values(cycle.marketSector.marketRuntime.marketStates)) {
    if (!state) continue;
    const dataGaps = unique(state.dataGaps ?? []);
    events.push({
      eventKey: `${prefix}:market-state:${state.horizon}`,
      occurredAt: state.asOf,
      runtimeId,
      eventType: 'SYSTEM',
      eventName: 'V10_MARKET_STATE_OBSERVED',
      market: 'KRX',
      action: state.stance,
      summary: `KRX ${state.horizon} Market State ${state.stance} · score ${state.score.toFixed(1)} · official EOD fallback.`,
      reason: dataGaps[0] ?? 'Official KRX end-of-day breadth and cross-sectional return state observed.',
      severity: dataGaps.length ? 'WARN' : 'INFO',
      authority: 'research_shadow',
      executionAuthority: false,
      source: 'krx_official_eod',
      trace: {
        stage: 'MARKET_STATE',
        horizon: state.horizon,
        score: state.score,
        confidence: state.confidence,
        stance: state.stance,
        riskMultiplier: state.riskMultiplier,
        indexTrendScore: state.indexTrendScore,
        breadthScore: state.breadthScore,
        turnoverScore: state.turnoverScore,
        volatilityScore: state.volatilityScore,
        evidenceScore: state.evidenceScore,
        dataGaps,
        sourceIds: cycle.sourceIds,
        marketDataQuality: 'EOD',
      },
      links: { sourceIds: cycle.sourceIds },
    });
  }

  for (const sector of cycle.marketSector.sectorScores.slice(0, 20)) {
    events.push({
      eventKey: `${prefix}:sector-state:SHORT:${sector.sector}`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'SYSTEM',
      eventName: 'V10_SECTOR_STATE_OBSERVED',
      market: 'KRX',
      action: sector.score.stance,
      summary: `${sector.sector} SHORT Sector Strength ${sector.score.stance} · score ${sector.score.score.toFixed(1)} · breadth ${sector.breadthPct.toFixed(0)}%.`,
      reason: sector.dataGaps[0] ?? 'Official KRX sector classification, EOD relative strength and breadth produced the shadow sector rank.',
      severity: sector.dataGaps.length ? 'WARN' : 'INFO',
      authority: 'research_shadow',
      executionAuthority: false,
      source: 'krx_official_eod',
      trace: {
        stage: 'SECTOR_STATE',
        horizon: 'SHORT',
        sector: sector.sector,
        score: sector.score.score,
        stance: sector.score.stance,
        constituentCount: sector.constituentCount,
        positiveCount: sector.positiveCount,
        breadthPct: sector.breadthPct,
        relativeStrength: sector.score.relativeStrength,
        volumeParticipation: sector.score.volumeParticipation,
        evidenceScore: sector.score.evidenceScore,
        dataGaps: sector.dataGaps,
        sourceIds: cycle.sourceIds,
        marketDataQuality: 'EOD',
      },
      links: { sourceIds: cycle.sourceIds },
    });
  }

  for (const candidate of cycle.committeeCandidates.slice(0, 30)) {
    events.push({
      eventKey: `${prefix}:universe:${candidate.market}`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'SYSTEM',
      eventName: 'V10_UNIVERSE_GATE_EVALUATED',
      market: candidate.market,
      action: candidate.hardGateEligible ? 'QUALIFIED' : 'BLOCKED',
      summary: `${candidate.market} ${candidate.name} · ${candidate.sector} · Committee pool rank #${candidate.rank} · score ${candidate.score.toFixed(1)} · hard gate ${candidate.hardGateEligible ? 'PASS' : 'BLOCKED'}.`,
      reason: candidate.blockers[0] ?? 'KRX hard-universe research gate passed.',
      severity: candidate.hardGateEligible ? 'INFO' : 'WARN',
      authority: 'research_shadow',
      executionAuthority: false,
      source: 'krx_official_eod',
      trace: {
        stage: 'UNIVERSE_GATE',
        horizon: candidate.horizon,
        rank: candidate.rank,
        score: candidate.score,
        sector: candidate.sector,
        sectorScore: candidate.sectorScore,
        dailyVolume: candidate.dailyVolume,
        marketCapKrw: candidate.marketCapKrw,
        changeRate: candidate.changeRate,
        evidenceScore: candidate.evidenceScore,
        evidenceCount: candidate.evidenceCount,
        gateDisposition: candidate.hardGateEligible ? 'QUALIFIED' : 'BLOCKED',
        nominationReady: candidate.nominationReady,
        dataGaps: candidate.blockers,
        marketDataQuality: 'EOD',
        sourceIds: cycle.sourceIds,
      },
      links: { evidenceIds: candidate.evidenceIds, sourceIds: cycle.sourceIds },
    });
  }

  events.push({
    eventKey: `${prefix}:committee-pool`,
    occurredAt: timestamp,
    runtimeId,
    eventType: 'COUNCIL',
    eventName: 'V10_COMMITTEE_CANDIDATE_POOL_BUILT',
    market: 'KRX',
    action: cycle.committeeCandidates.length ? 'POOL_BUILT' : 'EMPTY',
    summary: `KRX Committee candidate pool contains ${cycle.committeeCandidates.length} SHORT-horizon research candidate(s); ${cycle.nominationReadyCount} are nomination-ready after Hard Universe gates.`,
    reason: cycle.blockers[0] ?? 'Strong-sector and cross-sectional research ranking completed.',
    severity: cycle.nominationReadyCount > 0 ? 'INFO' : 'WARN',
    authority: 'research_shadow',
    executionAuthority: false,
    source: 'krx_official_eod',
    trace: {
      stage: 'CANDIDATE_POOL',
      horizon: 'SHORT',
      candidateCount: cycle.committeeCandidates.length,
      nominationReadyCount: cycle.nominationReadyCount,
      topCandidates: cycle.committeeCandidates.slice(0, 10).map((item) => ({
        market: item.market,
        name: item.name,
        sector: item.sector,
        rank: item.rank,
        score: item.score,
        hardGateEligible: item.hardGateEligible,
      })),
      blockers: cycle.blockers,
      sourceIds: cycle.sourceIds,
    },
  });

  if (cycle.nominationReadyCount === 0) {
    events.push({
      eventKey: `${prefix}:nomination-readiness`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'COUNCIL',
      eventName: 'V10_NOMINATION_READINESS_BLOCKED',
      market: 'KRX',
      action: 'BLOCKED',
      summary: 'Investment Committee nomination producer is reachable, but no KRX candidate may be promoted because Hard Universe evidence is incomplete.',
      reason: cycle.blockers.find((item) => /crypto|hard universe|nomination/i.test(item)) ?? cycle.blockers[0] ?? 'Hard Universe qualification is incomplete.',
      severity: 'WARN',
      authority: 'research_shadow',
      executionAuthority: false,
      source: 'krx_official_eod',
      trace: {
        stage: 'NOMINATION',
        horizon: 'SHORT',
        nominationReady: false,
        dataGaps: cycle.blockers,
        sourceIds: cycle.sourceIds,
      },
    });
  }

  return events;
};
