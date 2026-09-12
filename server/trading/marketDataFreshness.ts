export type MarketDataFreshnessStatus = 'NO_SAMPLE' | 'PARTIAL' | 'FRESH' | 'STALE' | 'CRITICAL';

export type MarketDataFreshness = {
  status: MarketDataFreshnessStatus;
  checkedAt: number;
  cycleFinishedAt: number | null;
  observedMarketCount: number;
  timestampedMarketCount: number;
  coverage: number | null;
  newestTimestamp: number | null;
  oldestTimestamp: number | null;
  maxAgeMs: number | null;
  warnAfterMs: number;
  criticalAfterMs: number;
  futureTimestampCount: number;
  historicalTimeframesObserved: false;
  unobservedTimeframes: ['15m', '1h', '4h'];
  reason: string;
};

type MarketTraceLike = {
  market?: string;
  liquidity?: {
    marketDataTimestamp?: number | null;
  } | null;
};

type CycleLike = {
  finishedAt?: number | null;
  markets?: MarketTraceLike[];
} | null | undefined;

const finiteTimestamp = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/**
 * Measures only the live-liquidity timestamps actually preserved on the latest
 * completed Paper decision traces. It intentionally does not infer 15m/1h/4h
 * candle-source freshness from cycle recency or decision timestamps.
 */
export const buildMarketDataFreshness = (
  lastCycle: CycleLike,
  intervalMs: number,
  now = Date.now(),
): MarketDataFreshness => {
  const cadenceMs = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 15 * 60_000;
  const warnAfterMs = Math.round(cadenceMs * 1.5);
  const criticalAfterMs = Math.round(cadenceMs * 2.5);
  const traces = Array.isArray(lastCycle?.markets) ? lastCycle!.markets! : [];
  const futureToleranceMs = 60_000;
  const timestamps: number[] = [];
  let futureTimestampCount = 0;

  for (const trace of traces) {
    const timestamp = finiteTimestamp(trace?.liquidity?.marketDataTimestamp);
    if (timestamp == null) continue;
    if (timestamp > now + futureToleranceMs) {
      futureTimestampCount += 1;
      continue;
    }
    timestamps.push(timestamp);
  }

  const observedMarketCount = traces.length;
  const timestampedMarketCount = timestamps.length;
  const coverage = observedMarketCount > 0 ? timestampedMarketCount / observedMarketCount : null;
  const newestTimestamp = timestamps.length ? Math.max(...timestamps) : null;
  const oldestTimestamp = timestamps.length ? Math.min(...timestamps) : null;
  const maxAgeMs = oldestTimestamp == null ? null : Math.max(0, now - oldestTimestamp);
  const cycleFinishedAt = finiteTimestamp(lastCycle?.finishedAt) ?? null;

  let status: MarketDataFreshnessStatus = 'NO_SAMPLE';
  let reason = 'No completed market trace exposes a live-liquidity source timestamp.';

  if (observedMarketCount > 0 && timestampedMarketCount === 0) {
    status = 'PARTIAL';
    reason = 'The latest completed cycle has market traces, but none preserve a valid live-liquidity source timestamp.';
  } else if (timestampedMarketCount > 0) {
    if (futureTimestampCount > 0) {
      status = 'PARTIAL';
      reason = `${futureTimestampCount} market-data timestamp(s) are implausibly in the future and were excluded.`;
    } else if (maxAgeMs != null && maxAgeMs > criticalAfterMs) {
      status = 'CRITICAL';
      reason = `Oldest preserved live-liquidity timestamp is ${Math.round(maxAgeMs / 60_000)}m old, beyond the ${Math.round(criticalAfterMs / 60_000)}m critical window.`;
    } else if (maxAgeMs != null && maxAgeMs > warnAfterMs) {
      status = 'STALE';
      reason = `Oldest preserved live-liquidity timestamp is ${Math.round(maxAgeMs / 60_000)}m old, beyond the ${Math.round(warnAfterMs / 60_000)}m warning window.`;
    } else if (coverage !== 1) {
      status = 'PARTIAL';
      reason = `Live-liquidity source timestamps cover ${timestampedMarketCount}/${observedMarketCount} latest-cycle market trace(s).`;
    } else {
      status = 'FRESH';
      reason = `All ${observedMarketCount} latest-cycle market trace(s) preserve live-liquidity timestamps within the cadence-aware freshness window.`;
    }
  }

  return {
    status,
    checkedAt: now,
    cycleFinishedAt,
    observedMarketCount,
    timestampedMarketCount,
    coverage,
    newestTimestamp,
    oldestTimestamp,
    maxAgeMs,
    warnAfterMs,
    criticalAfterMs,
    futureTimestampCount,
    historicalTimeframesObserved: false,
    unobservedTimeframes: ['15m', '1h', '4h'],
    reason,
  };
};
