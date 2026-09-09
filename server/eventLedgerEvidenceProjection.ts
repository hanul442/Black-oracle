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
    events.push({
      eventKey: `${runtimeId}:${market}:${timestamp}:equity-decision:${action}`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'DECISION',
      eventName: 'EQUITY_RESEARCH_DECISION',
      market,
      action,
      summary: `${market} equity research decision ${action}; execution remains disabled until equity-specific cutover gates pass.`,
      reason: asArray(item?.reasons).map(String)[0] ?? 'Equity research cycle recorded no primary rationale.',
      severity: 'INFO',
      authority: 'research_only',
      executionAuthority: false,
      source: 'equity_paper_research',
      trace: {
        name: item?.name ?? null,
        price: item?.price ?? null,
        technicalScore: item?.technicalScore ?? null,
        evidenceScore: item?.evidenceScore ?? null,
        waveScore: item?.waveScore ?? null,
        intradayAction: item?.intradayAction ?? null,
        relativeVolume: item?.relativeVolume ?? null,
        priceVsVwapPct: item?.priceVsVwapPct ?? null,
        volumeAbsorptionScore: item?.volumeAbsorptionScore ?? null,
        absorptionCandidate: item?.absorptionCandidate ?? null,
      },
      links: { evidenceIds },
    });
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

  return events;
};
