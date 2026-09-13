import type { CanonicalEventInput } from './eventLedger';

const requestKeyFromReasons = (reasons: unknown) => {
  if (!Array.isArray(reasons)) return null;
  for (const reason of reasons) {
    const text = String(reason ?? '');
    const match = text.match(/Evidence coverage request\s+([^\s]+)\s+queued/i);
    if (match?.[1]) return match[1];
  }
  return null;
};

const asArray = <T = any>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const finiteNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const buildEvidenceAndEquityCanonicalEvents = (cycle: any, runtimeId: string): CanonicalEventInput[] => {
  const occurredAt = Number(cycle?.finishedAt ?? Date.now());
  const cycleKey = `${runtimeId}:cycle:${occurredAt}`;
  const events: CanonicalEventInput[] = [];
  const evidenceOps = cycle?.evidenceOps ?? {};
  const evidenceActivity = Number(evidenceOps.importedBeforeConsume ?? 0)
    + Number(evidenceOps.consumedPackets ?? 0)
    + Number(evidenceOps.importedAfterConsume ?? 0)
    + Number(evidenceOps.acquisitionRequests ?? 0)
    + Number(evidenceOps.acquisitionSourcesIngested ?? 0);
  const evidenceErrors = asArray(evidenceOps.errors).map(String);

  if (evidenceActivity > 0 || evidenceErrors.length > 0) {
    events.push({
      eventKey: `${cycleKey}:evidence-pipeline`,
      occurredAt,
      runtimeId,
      eventType: 'EVIDENCE',
      eventName: 'NARS_EVIDENCE_PIPELINE_ACTIVITY',
      action: evidenceErrors.length ? 'DEGRADED' : 'PROCESSED',
      summary: `NARS bridge activity: consumed ${Number(evidenceOps.consumedPackets ?? 0)} analyzed packet(s), imported ${Number(evidenceOps.importedAfterConsume ?? evidenceOps.importedBeforeConsume ?? 0)} active Evidence item(s), requested ${Number(evidenceOps.acquisitionRequests ?? 0)} acquisition(s), ingested ${Number(evidenceOps.acquisitionSourcesIngested ?? 0)} source(s).`,
      reason: evidenceErrors[0] ?? 'Evidence operations completed as advisory/source-backed context with no execution authority.',
      severity: evidenceErrors.length ? 'WARN' : 'INFO',
      authority: 'evidence_only',
      executionAuthority: false,
      source: 'nars_bridge',
      trace: {
        importedBeforeConsume: Number(evidenceOps.importedBeforeConsume ?? 0),
        consumedPackets: Number(evidenceOps.consumedPackets ?? 0),
        importedAfterConsume: Number(evidenceOps.importedAfterConsume ?? 0),
        acquisitionRequests: Number(evidenceOps.acquisitionRequests ?? 0),
        acquisitionSourcesIngested: Number(evidenceOps.acquisitionSourcesIngested ?? 0),
        errors: evidenceErrors,
      },
    });
  }

  for (const item of asArray(cycle?.markets)) {
    const requestKey = requestKeyFromReasons(item?.reasons);
    if (!requestKey) continue;
    const market = String(item?.market ?? 'UNKNOWN');
    const timestamp = Number(item?.timestamp ?? occurredAt);
    events.push({
      eventKey: `${runtimeId}:${market}:${timestamp}:evidence-coverage-request:${requestKey}`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'EVIDENCE',
      eventName: 'EVIDENCE_COVERAGE_REQUESTED',
      market,
      strategyId: item?.strategyDisposition == null ? null : String(item.strategyDisposition),
      action: 'REQUESTED',
      summary: `${market} technical candidate lacked required source-backed Evidence; NARS coverage request ${requestKey} was queued.`,
      reason: asArray(item?.reasons).map(String).find((reason) => reason.includes(requestKey)) ?? 'Evidence-required asset policy requested source acquisition before re-evaluation.',
      severity: 'INFO',
      authority: 'evidence_only',
      executionAuthority: false,
      source: 'evidence_coverage_queue',
      trace: {
        requestKey,
        decision: item?.decision ?? item?.action ?? null,
        evidenceActiveCount: item?.evidenceActiveCount ?? 0,
        strategyDisposition: item?.strategyDisposition ?? null,
      },
      links: { requestKey },
    });
  }

  const equityCycle = cycle?.equityCycle;
  for (const item of asArray(equityCycle?.decisions)) {
    const market = String(item?.market ?? 'UNKNOWN');
    const timestamp = Number(equityCycle?.finishedAt ?? occurredAt);
    const evidenceIds = asArray(item?.evidenceIds).map(String);
    const action = String(item?.action ?? 'RESEARCH_ONLY');
    const reasons = asArray(item?.reasons).map(String);
    const relativeVolume = finiteNumber(item?.relativeVolume);
    const volumeAbsorptionScore = finiteNumber(item?.volumeAbsorptionScore);
    const priceVsVwapPct = finiteNumber(item?.priceVsVwapPct);
    const hasFootprintObservation = relativeVolume != null
      || volumeAbsorptionScore != null
      || priceVsVwapPct != null
      || item?.absorptionCandidate != null;

    events.push({
      eventKey: `${runtimeId}:${market}:${timestamp}:equity-decision:${action}`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'DECISION',
      eventName: 'EQUITY_RESEARCH_DECISION',
      market,
      action,
      summary: `${market} equity research decision ${action}; execution remains disabled until equity-specific cutover gates pass.`,
      reason: reasons[0] ?? 'Equity research cycle recorded no primary rationale.',
      severity: 'INFO',
      authority: 'research_only',
      executionAuthority: false,
      source: 'equity_paper_research',
      trace: {
        name: item?.name ?? null,
        price: item?.price ?? null,
        sector: item?.sector ?? null,
        marketCapKrw: item?.marketCapKrw ?? null,
        dailyVolume: item?.dailyVolume ?? null,
        volumeTurnoverRate: item?.volumeTurnoverRate ?? null,
        foreignNetBuyQty: item?.foreignNetBuyQty ?? null,
        programNetBuyQty: item?.programNetBuyQty ?? null,
        marketWarning: item?.marketWarning ?? false,
        technicalScore: item?.technicalScore ?? null,
        evidenceScore: item?.evidenceScore ?? null,
        waveScore: item?.waveScore ?? null,
        intradayAction: item?.intradayAction ?? null,
        relativeVolume,
        priceVsVwapPct,
        volumeAbsorptionScore,
        absorptionCandidate: item?.absorptionCandidate ?? null,
      },
      links: { evidenceIds },
    });

    // V10 projection records that the equity runtime observed a candidate. It does not
    // claim the hard universe gate passed unless the dedicated gate producer proves it.
    events.push({
      eventKey: `${runtimeId}:${market}:${timestamp}:v10-universe-candidate-observed`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'SYSTEM',
      eventName: 'V10_UNIVERSE_CANDIDATE_OBSERVED',
      market,
      action: 'OBSERVED',
      summary: `${market} appeared in the KRX equity research cycle and is visible to the V10 operational read model.`,
      reason: reasons[0] ?? 'Candidate observation is research-only and does not imply that all V10 universe hard gates passed.',
      severity: 'INFO',
      authority: 'research_shadow',
      executionAuthority: false,
      source: 'equity_paper_runtime',
      trace: {
        stage: 'UNIVERSE_GATE',
        gateDisposition: 'OBSERVED_NOT_QUALIFIED',
        name: item?.name ?? null,
        price: item?.price ?? null,
        sector: item?.sector ?? null,
        marketCapKrw: item?.marketCapKrw ?? null,
        dailyVolume: item?.dailyVolume ?? null,
        volumeTurnoverRate: item?.volumeTurnoverRate ?? null,
        foreignNetBuyQty: item?.foreignNetBuyQty ?? null,
        programNetBuyQty: item?.programNetBuyQty ?? null,
        marketWarning: item?.marketWarning ?? false,
        technicalScore: item?.technicalScore ?? null,
        evidenceScore: item?.evidenceScore ?? null,
        evidenceCount: item?.evidenceCount ?? evidenceIds.length,
        relativeVolume,
        priceVsVwapPct,
        volumeAbsorptionScore,
        dataGaps: ['Dedicated V10 hard-universe qualification event is not emitted by this legacy equity research path.'],
      },
      links: { evidenceIds },
    });

    if (hasFootprintObservation) {
      events.push({
        eventKey: `${runtimeId}:${market}:${timestamp}:v10-large-participant-footprint-observed`,
        occurredAt: timestamp,
        runtimeId,
        eventType: 'EVIDENCE',
        eventName: 'V10_LARGE_PARTICIPANT_FOOTPRINT_OBSERVED',
        market,
        action: 'BEHAVIOR_PROXY',
        summary: `${market} large-participant footprint inputs were observed from price/volume behavior; no actor identity or manipulation claim is made.`,
        reason: 'Relative volume, VWAP location and absorption-like behavior are behavioral proxies only; named participants require independently verified flow/ownership data.',
        severity: 'INFO',
        authority: 'evidence_only',
        executionAuthority: false,
        source: 'equity_paper_runtime',
        trace: {
          stage: 'LARGE_PARTICIPANT_FOOTPRINT',
          relativeVolume,
          priceVsVwapPct,
          volumeAbsorptionScore,
          absorptionCandidate: item?.absorptionCandidate ?? null,
          foreignNetBuyQty: item?.foreignNetBuyQty ?? null,
          programNetBuyQty: item?.programNetBuyQty ?? null,
          actorIdentityVerified: false,
        },
        links: { evidenceIds },
      });
    }

    if (evidenceIds.length) {
      events.push({
        eventKey: `${runtimeId}:${market}:${timestamp}:equity-evidence`,
        occurredAt: timestamp,
        runtimeId,
        eventType: 'EVIDENCE',
        eventName: 'EQUITY_EVIDENCE_LINKED',
        market,
        action,
        summary: `${market} equity research decision linked ${evidenceIds.length} source-backed Evidence item(s).`,
        reason: 'Evidence is advisory/research context only; equity execution authority remains disabled.',
        authority: 'evidence_only',
        executionAuthority: false,
        source: 'equity_paper_research',
        trace: { evidenceScore: item?.evidenceScore ?? null },
        links: { evidenceIds },
      });
    }
  }

  const marketSector = equityCycle?.marketSector;
  const marketStates = marketSector?.marketRuntime?.marketStates && typeof marketSector.marketRuntime.marketStates === 'object'
    ? Object.values(marketSector.marketRuntime.marketStates)
    : [];
  for (const rawState of marketStates as any[]) {
    if (!rawState) continue;
    const horizon = String(rawState.horizon ?? 'SHORT');
    const timestamp = Number(rawState.asOf ?? marketSector?.asOf ?? equityCycle?.finishedAt ?? occurredAt);
    const dataGaps = asArray(rawState.dataGaps).map(String);
    const sourceIds = asArray(rawState.sourceIds).map(String);
    events.push({
      eventKey: `${runtimeId}:KRX:${timestamp}:v10-market-state:${horizon}`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'SYSTEM',
      eventName: 'V10_MARKET_STATE_OBSERVED',
      market: 'KRX',
      action: String(rawState.stance ?? 'NEUTRAL'),
      summary: `KRX ${horizon} Market State ${String(rawState.stance ?? 'NEUTRAL')} · score ${Number(rawState.score ?? 0).toFixed(1)} · confidence ${(Number(rawState.confidence ?? 0) * 100).toFixed(0)}%.`,
      reason: dataGaps[0] ?? asArray(rawState.reasons).map(String)[0] ?? 'Official KIS index state was observed for V10 shadow research.',
      severity: dataGaps.length ? 'WARN' : 'INFO',
      authority: 'research_shadow',
      executionAuthority: false,
      source: 'krx_market_sector_shadow',
      trace: {
        stage: 'MARKET_STATE',
        horizon,
        score: rawState.score ?? null,
        confidence: rawState.confidence ?? null,
        stance: rawState.stance ?? null,
        riskMultiplier: rawState.riskMultiplier ?? null,
        indexTrendScore: rawState.indexTrendScore ?? null,
        breadthScore: rawState.breadthScore ?? null,
        turnoverScore: rawState.turnoverScore ?? null,
        volatilityScore: rawState.volatilityScore ?? null,
        evidenceScore: rawState.evidenceScore ?? null,
        dataGaps,
        sourceIds,
      },
      links: { sourceIds },
    });
  }

  for (const sector of asArray(marketSector?.sectorScores)) {
    const score = sector?.score ?? {};
    const horizon = String(score?.horizon ?? marketSector?.horizon ?? 'SHORT');
    const sectorName = String(sector?.sector ?? score?.sector ?? 'UNKNOWN');
    const timestamp = Number(marketSector?.asOf ?? equityCycle?.finishedAt ?? occurredAt);
    const dataGaps = asArray(sector?.dataGaps).map(String);
    events.push({
      eventKey: `${runtimeId}:KRX:${timestamp}:v10-sector-state:${horizon}:${sectorName}`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'SYSTEM',
      eventName: 'V10_SECTOR_STATE_OBSERVED',
      action: String(score?.stance ?? 'NEUTRAL'),
      summary: `${sectorName} ${horizon} Sector Strength ${String(score?.stance ?? 'NEUTRAL')} · score ${Number(score?.score ?? 0).toFixed(1)} · breadth ${Number(sector?.breadthPct ?? 0).toFixed(0)}%.`,
      reason: dataGaps[0] ?? 'Sector state is a shadow research ranking from KIS sector tags, relative strength, breadth, volume participation and source-backed Evidence.',
      severity: dataGaps.length ? 'WARN' : 'INFO',
      authority: 'research_shadow',
      executionAuthority: false,
      source: 'krx_market_sector_shadow',
      trace: {
        stage: 'SECTOR_STATE',
        horizon,
        sector: sectorName,
        score: score?.score ?? null,
        stance: score?.stance ?? null,
        constituentCount: sector?.constituentCount ?? null,
        positiveCount: sector?.positiveCount ?? null,
        breadthPct: sector?.breadthPct ?? null,
        relativeStrength: score?.relativeStrength ?? null,
        volumeParticipation: score?.volumeParticipation ?? null,
        evidenceScore: score?.evidenceScore ?? null,
        riskPenalty: score?.riskPenalty ?? null,
        dataGaps,
      },
    });
  }

  return events;
};