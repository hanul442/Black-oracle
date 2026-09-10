const boundedString = (value: unknown, max = 800) => String(value ?? '').slice(0, max);
const boundedArray = (value: unknown, max = 10, itemMax = 500) => Array.isArray(value)
  ? value.slice(0, max).map((item) => boundedString(item, itemMax))
  : [];

export const buildAiCouncilAuditPacket = (trace: any) => ({
  identity: {
    timestamp: Number(trace?.timestamp ?? 0),
    market: String(trace?.market ?? ''),
    action: String(trace?.action ?? ''),
    strategyDisposition: trace?.strategyDisposition ?? null,
  },
  decision: {
    oracleTradeScore: Number(trace?.oracleTradeScore ?? 0),
    confidence: Number(trace?.confidence ?? 0),
    regime: trace?.regime ?? null,
    regimeConfidence: trace?.regimeConfidence ?? null,
    riskDisposition: trace?.riskDisposition ?? null,
    primaryReason: boundedString(trace?.primaryReason),
    reasons: boundedArray(trace?.reasons),
    riskReasons: boundedArray(trace?.riskReasons, 8),
  },
  evidence: {
    eventScore: trace?.eventScore ?? null,
    activeCount: Number(trace?.evidenceActiveCount ?? 0),
    contradictionCount: Number(trace?.evidenceContradictionCount ?? 0),
    evidenceIds: boundedArray(trace?.evidenceIds, 20, 200),
  },
  deterministicCouncil: trace?.council ? {
    verdict: trace.council.verdict ?? null,
    counts: {
      approve: Number(trace.council.approveCount ?? 0),
      caution: Number(trace.council.cautionCount ?? 0),
      reject: Number(trace.council.rejectCount ?? 0),
      abstain: Number(trace.council.abstainCount ?? 0),
    },
    members: Array.isArray(trace.council.members)
      ? trace.council.members.slice(0, 8).map((member: any) => ({
          role: member?.role ?? null,
          vote: member?.vote ?? null,
          confidence: member?.confidence ?? null,
          reasons: boundedArray(member?.reasons, 3, 400),
        }))
      : [],
  } : null,
  arbiter: trace?.arbiter ?? null,
  cycle: trace?.cycle ?? null,
  technicalEvidence: trace?.technicalEvidence ?? null,
  structure: trace?.structure ?? null,
  microstructure: trace?.microstructure ?? null,
  challenger: trace?.challenger ?? null,
  tradeMap: trace?.tradeMap ?? null,
  dataCompleteness: {
    liquidityMetricsProvided: Boolean(trace?.liquidity),
    portfolioExposureProvided: Boolean(trace?.portfolio || trace?.portfolioRisk),
    positionSizingArithmeticProvided: Boolean(trace?.positionSizing || trace?.sizing),
    feeSlippageBreakdownProvided: Boolean(trace?.executionCosts || trace?.costModel),
    tradeMapProvided: Boolean(trace?.tradeMap),
    microstructureProvided: Boolean(trace?.microstructure),
    cycleProvided: Boolean(trace?.cycle),
    arbiterProvided: Boolean(trace?.arbiter),
  },
});
