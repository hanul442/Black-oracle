export type CanonicalSourceState = 'OK' | 'DEGRADED' | 'UNAVAILABLE';

export type CanonicalSourceHealth = {
  state: CanonicalSourceState;
  observedAt: number;
  stale: boolean;
  verifiedEmpty: boolean;
  error: string | null;
};

const finiteNumber = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const canonicalSourceHealth = (input: {
  observedAt?: number;
  now?: number;
  staleAfterMs?: number;
  itemCount?: number;
  degraded?: boolean;
  unavailable?: boolean;
  error?: string | null;
}): CanonicalSourceHealth => {
  const now = finiteNumber(input.now) ? input.now : Date.now();
  const observedAt = finiteNumber(input.observedAt) ? input.observedAt : now;
  const staleAfterMs = finiteNumber(input.staleAfterMs) && input.staleAfterMs >= 0
    ? input.staleAfterMs
    : 60_000;
  const stale = Math.max(0, now - observedAt) > staleAfterMs;
  const unavailable = Boolean(input.unavailable);
  const degraded = Boolean(input.degraded) || stale || Boolean(input.error);
  const state: CanonicalSourceState = unavailable ? 'UNAVAILABLE' : degraded ? 'DEGRADED' : 'OK';
  const count = finiteNumber(input.itemCount) ? Math.max(0, input.itemCount) : null;

  return {
    state,
    observedAt,
    stale,
    verifiedEmpty: state === 'OK' && count === 0,
    error: input.error ? String(input.error) : null,
  };
};
