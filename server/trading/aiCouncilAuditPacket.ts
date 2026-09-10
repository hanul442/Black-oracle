const boundedString = (value: unknown, max = 800) => String(value ?? '').slice(0, max);
const boundedOptionalString = (value: unknown, max = 800) => value == null ? null : boundedString(value, max);
const boundedArray = (value: unknown, max = 10, itemMax = 500) => Array.isArray(value)
  ? value.slice(0, max).map((item) => boundedString(item, itemMax))
  : [];
const finiteNumberOrNull = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const provided = (value: unknown) => value !== null && value !== undefined;

export const buildAiCouncilAuditPacket = (trace: any) => {
  const completeness = {
    cycleProvided: provided(trace?.cycle),
    structureProvided: provided(trace?.structure),
    microstructureProvided: provided(trace?.microstructure),
    challengerProvided: provided(trace?.challenger),
    tradeMapProvided: provided(trace?.tradeMap),
    riskDispositionProvided: provided(trace?.riskDisposition),
    riskReasonsProvided: Array.isArray(trace?.riskReasons),
    liquidityMetricsProvided: provided(trace?.liquidity),
    portfolioExposureProvided: provided(trace?.portfolio) || provided(trace?.portfolioRisk),
    positionSizingArithmeticProvided: provided(trace?.positionSizing) || provided(trace?.sizing),
    feeSlippageBreakdownProvided: provided(trace?.executionCosts) || provided(trace?.costModel),
    arbiterProvided: provided(trace?.arbiter),
  };
  const requiredShadowInputs = [
    ['cycle', completeness.cycleProvided],
    ['structure', completeness.structureProvided],
    ['microstructure', completeness.microstructureProvided],
    ['challenger', completeness.challengerProvided],
    ['tradeMap', completeness.tradeMapProvided],
    ['riskDisposition', completeness.riskDispositionProvided],
    ['riskReasons', completeness.riskReasonsProvided],
    ['liquidity', completeness.liquidityMetricsProvided],
    ['portfolioRisk', completeness.portfolioExposureProvided],
    ['positionSizing', completeness.positionSizingArithmeticProvided],
    ['executionCosts', completeness.feeSlippageBreakdownProvided],
  ] as const;

  return {
    identity: {
      timestamp: finiteNumberOrNull(trace?.timestamp),
      market: boundedOptionalString(trace?.market, 100),
      action: boundedOptionalString(trace?.action, 40),
      strategyDisposition: trace?.strategyDisposition ?? null,
    },
    decision: {
      oracleTradeScore: finiteNumberOrNull(trace?.oracleTradeScore),
      confidence: finiteNumberOrNull(trace?.confidence),
      regime: trace?.regime ?? null,
      regimeConfidence: finiteNumberOrNull(trace?.regimeConfidence),
      riskDisposition: trace?.riskDisposition ?? null,
      primaryReason: boundedOptionalString(trace?.primaryReason),
      reasons: boundedArray(trace?.reasons),
      riskReasons: boundedArray(trace?.riskReasons, 8),
    },
    evidence: {
      eventScore: finiteNumberOrNull(trace?.eventScore),
      activeCount: finiteNumberOrNull(trace?.evidenceActiveCount),
      contradictionCount: finiteNumberOrNull(trace?.evidenceContradictionCount),
      evidenceIds: boundedArray(trace?.evidenceIds, 20, 200),
    },
    deterministicCouncil: trace?.council ? {
      verdict: trace.council.verdict ?? null,
      counts: {
        approve: finiteNumberOrNull(trace.council.approveCount),
        caution: finiteNumberOrNull(trace.council.cautionCount),
        reject: finiteNumberOrNull(trace.council.rejectCount),
        abstain: finiteNumberOrNull(trace.council.abstainCount),
      },
      members: Array.isArray(trace.council.members)
        ? trace.council.members.slice(0, 8).map((member: any) => ({
            role: member?.role ?? null,
            vote: member?.vote ?? null,
            confidence: finiteNumberOrNull(member?.confidence),
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
    riskSizing: {
      riskDisposition: trace?.riskDisposition ?? null,
      riskReasons: boundedArray(trace?.riskReasons, 8),
      liquidity: trace?.liquidity ?? null,
      portfolioRisk: trace?.portfolioRisk ?? trace?.portfolio ?? null,
      positionSizing: trace?.positionSizing ?? trace?.sizing ?? null,
      executionCosts: trace?.executionCosts ?? trace?.costModel ?? null,
    },
    dataCompleteness: {
      ...completeness,
      requiredShadowInputsComplete: requiredShadowInputs.every(([, isProvided]) => isProvided),
      missingInputs: requiredShadowInputs.filter(([, isProvided]) => !isProvided).map(([name]) => name),
    },
  };
};
