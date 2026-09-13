import type { CanonicalPaperEventRow } from './canonicalPaperProtectionReplay';

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
};

const bytesToHex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Produces a deterministic SHA-256 fingerprint for one frozen canonical event
 * snapshot. Object keys are recursively sorted so semantically identical JSON
 * rows hash identically even if their property insertion order differs.
 */
export const fingerprintCanonicalPaperEvents = async (
  runtimeId: string,
  snapshotRecordedAt: string | null,
  rows: CanonicalPaperEventRow[],
): Promise<string> => {
  const payload = JSON.stringify(canonicalize({
    runtimeId,
    snapshotRecordedAt,
    rows,
  }));
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(payload),
  );
  return `sha256:${bytesToHex(digest)}`;
};
