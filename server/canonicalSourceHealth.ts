export type CanonicalSourceState = 'OK' | 'DEGRADED' | 'UNAVAILABLE';

export type CanonicalSourceHealth = {
  state: CanonicalSourceState;
  observedAt: number;
  stale: boolean;
  verifiedEmpty: boolean;
  error: string | null;
};

export const canonicalSourceHealth = (input: {
  observedAt?: number;
  now?: number;
  staleAfterMs?: number;
  itemCount?: number;
  degraded?: boolean;
  unavailable?: boolean;
  error?: string | null;
}): CanonicalSourceHealth => {
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  const observedAt = Number.isFinite(input.observedAt) ? Number(input.observedAt) : now;
  const staleAfterMs = Number.isFinite(input.staleAfterMs) && Number(input.staleAfterMs) >= 0
    ? Number(input.staleAfterMs)
    : 60_000;
  const stale = Math.max(0, now - observedAt) > staleAfterMs;
  const unavailable = Boolean(input.unavailable);
  const degraded = Boolean(input.degraded) || stale || Boolean(input.error);
  const state: CanonicalSourceState = unavailable ? 'UNAVAILABLE' : degraded ? 'DEGRADED' : 'OK';
  const count = Number.isFinite(input.itemCount) ? Math.max(0, Number(input.itemCount)) : null;

  return {
    state,
    observedAt,
    stale,
    verifiedEmpty: state === 'OK' && count === 0,
    error: input.error ? String(input.error) : null,
  };
};
