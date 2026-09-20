import type { UpbitKrwUniverseSnapshot } from './upbitKrwUniverse';

export interface UniverseFreshnessPolicy {
  maxAgeMs: number;
  maxFutureSkewMs?: number;
}

export interface UniverseFreshnessDecision {
  usable: boolean;
  ageMs: number | null;
  reason: 'FRESH' | 'STALE' | 'FUTURE_TIMESTAMP' | 'INVALID_TIMESTAMP';
}

/**
 * Fail-closed freshness gate for scanner discovery snapshots.
 * A usable snapshot only permits market scanning; it never grants execution authority.
 */
export const evaluateUniverseFreshness = (
  snapshot: Pick<UpbitKrwUniverseSnapshot, 'observedAt'>,
  now: Date = new Date(),
  policy: UniverseFreshnessPolicy = { maxAgeMs: 5 * 60_000, maxFutureSkewMs: 30_000 },
): UniverseFreshnessDecision => {
  if (!Number.isFinite(policy.maxAgeMs) || policy.maxAgeMs < 0) {
    throw new Error('maxAgeMs must be a finite non-negative number.');
  }
  const maxFutureSkewMs = policy.maxFutureSkewMs ?? 30_000;
  if (!Number.isFinite(maxFutureSkewMs) || maxFutureSkewMs < 0) {
    throw new Error('maxFutureSkewMs must be a finite non-negative number.');
  }
  if (Number.isNaN(now.getTime())) throw new Error('now must be a valid Date.');

  const observedMs = Date.parse(snapshot.observedAt);
  if (!Number.isFinite(observedMs)) {
    return { usable: false, ageMs: null, reason: 'INVALID_TIMESTAMP' };
  }

  const ageMs = now.getTime() - observedMs;
  if (ageMs < -maxFutureSkewMs) return { usable: false, ageMs, reason: 'FUTURE_TIMESTAMP' };
  if (ageMs > policy.maxAgeMs) return { usable: false, ageMs, reason: 'STALE' };
  return { usable: true, ageMs, reason: 'FRESH' };
};
