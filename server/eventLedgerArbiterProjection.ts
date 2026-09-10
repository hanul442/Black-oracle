import type { CanonicalEventInput } from './eventLedger';

const numberOrNow = (value: unknown, fallback = Date.now()) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const buildArbiterCanonicalEvents = (
  cycle: { finishedAt?: number; markets?: any[] } | null | undefined,
  runtimeId: string,
): CanonicalEventInput[] => {
  const markets = Array.isArray(cycle?.markets) ? cycle!.markets! : [];
  const fallback = numberOrNow(cycle?.finishedAt);

  return markets.flatMap((item: any) => {
    const arbiter = item?.arbiter;
    if (!arbiter || typeof arbiter !== 'object') return [];

    const market = String(item?.market ?? 'UNKNOWN').toUpperCase();
    const timestamp = numberOrNow(item?.timestamp, fallback);
    const recommendation = String(arbiter?.recommendation ?? 'NOT_APPLICABLE');
    const reasons = Array.isArray(arbiter?.reasons) ? arbiter.reasons.map(String) : [];

    return [{
      eventKey: `${runtimeId}:${market}:${timestamp}:arbiter`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'COUNCIL' as const,
      eventName: 'ARBITER_RECOMMENDED',
      market,
      strategyId: item?.strategyDisposition == null ? null : String(item.strategyDisposition),
      strategyVersion: item?.strategyVersion == null ? null : String(item.strategyVersion),
      action: recommendation,
      summary: `${market} Shadow Arbiter recommendation: ${recommendation}.`,
      reason: reasons[0] ?? 'Shadow Arbiter recorded no primary rationale.',
      severity: recommendation === 'BLOCK' ? 'WARN' as const : 'INFO' as const,
      authority: 'shadow_arbiter',
      executionAuthority: false,
      source: 'shadow_arbiter',
      trace: {
        recommendation,
        reasons,
        councilVerdict: arbiter?.councilVerdict ?? null,
        cycleTiming: arbiter?.cycleTiming ?? null,
        challengerAlignment: arbiter?.challengerAlignment ?? null,
        mode: arbiter?.mode ?? 'SHADOW',
        executionAuthority: false,
        decision: item?.decision ?? item?.action ?? null,
        oracleTradeScore: item?.oracleTradeScore ?? null,
        confidence: item?.confidence ?? null,
      },
      links: {
        evidenceIds: Array.isArray(item?.evidenceIds) ? item.evidenceIds.map(String) : [],
      },
    } satisfies CanonicalEventInput];
  });
};
