import { fingerprintCanonicalPaperEvents } from './canonicalPaperEventFingerprint';
import type { CanonicalPaperEventRow } from './canonicalPaperProtectionReplay';
import { buildPaperProtectionDiagnostic } from './paperProtectionDiagnostic';
import {
  parsePaperProtectionEvidenceBaseline,
  type PaperProtectionEvidenceBaseline,
} from './paperProtectionEvidencePass';

export interface SavedCanonicalPaperEventExport {
  runtimeId: string;
  count: number;
  pages: number;
  pageSize: number;
  truncated: false;
  snapshotRecordedAt: string | null;
  snapshotFingerprint: string;
  rows: CanonicalPaperEventRow[];
}

export interface PaperProtectionBaselineVerificationResult {
  verified: true;
  runtimeId: string;
  snapshotRecordedAt: string | null;
  snapshotFingerprint: string;
  sourceRows: number;
  observations: number;
  changedExits: number;
  favorableOvershootRemoved: number;
  grossExitValueDelta: number;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const isSnapshotFingerprint = (value: unknown): value is string =>
  typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);

const parseTimestamp = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be a valid timestamp string.`);
  }
  return value;
};

const parseSnapshotRecordedAt = (value: unknown): string | null => {
  if (value === null) return null;
  return parseTimestamp(value, 'Canonical Paper export snapshotRecordedAt');
};

const parseIdentityId = (value: unknown, index: number): string | number => {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error(`Canonical Paper export row ${index} requires a stable id for pagination identity.`);
};

interface CanonicalPaginationIdentity {
  occurredAt: number;
  recordedAt: number;
  id: string | number;
}

const compareIds = (left: string | number, right: string | number): number => {
  if (typeof left !== typeof right) {
    throw new Error('Canonical Paper export mixes id types; deterministic pagination identity cannot be verified.');
  }
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  const leftString = String(left);
  const rightString = String(right);
  return leftString < rightString ? -1 : leftString > rightString ? 1 : 0;
};

const comparePaginationIdentity = (
  left: CanonicalPaginationIdentity,
  right: CanonicalPaginationIdentity,
): number => {
  if (left.occurredAt !== right.occurredAt) return left.occurredAt - right.occurredAt;
  if (left.recordedAt !== right.recordedAt) return left.recordedAt - right.recordedAt;
  return compareIds(left.id, right.id);
};

/**
 * Parses a saved output from `export:paper-protection-events` without trusting
 * operator-edited metadata. A truncated artifact, count mismatch, cross-runtime
 * row, malformed fingerprint, duplicate row identity, or pagination-order drift
 * fails closed before any baseline comparison.
 */
export const parseSavedCanonicalPaperEventExport = (
  value: unknown,
): SavedCanonicalPaperEventExport => {
  const candidate = asRecord(value);
  if (!candidate) throw new Error('Canonical Paper export must be a JSON object.');

  const runtimeId = typeof candidate.runtimeId === 'string' ? candidate.runtimeId.trim() : '';
  if (!runtimeId) throw new Error('Canonical Paper export requires runtimeId.');
  if (!isNonNegativeInteger(candidate.count)) throw new Error('Canonical Paper export count must be a non-negative integer.');
  if (!isNonNegativeInteger(candidate.pages)) throw new Error('Canonical Paper export pages must be a non-negative integer.');
  if (!isPositiveInteger(candidate.pageSize)) throw new Error('Canonical Paper export pageSize must be a positive integer.');
  if (candidate.truncated !== false) throw new Error('Canonical Paper export must be complete; truncated artifacts are not verifiable qualification evidence.');
  if (!isSnapshotFingerprint(candidate.snapshotFingerprint)) {
    throw new Error('Canonical Paper export requires a canonical sha256 snapshotFingerprint.');
  }
  if (!Array.isArray(candidate.rows)) throw new Error('Canonical Paper export requires a rows array.');
  if (candidate.count !== candidate.rows.length) {
    throw new Error(`Canonical Paper export count mismatch: metadata=${candidate.count}, rows=${candidate.rows.length}.`);
  }

  const snapshotRecordedAt = parseSnapshotRecordedAt(candidate.snapshotRecordedAt);
  if (candidate.rows.length > 0 && snapshotRecordedAt === null) {
    throw new Error('Non-empty canonical Paper export requires a frozen snapshotRecordedAt watermark.');
  }
  const snapshotRecordedAtMs = snapshotRecordedAt === null ? null : Date.parse(snapshotRecordedAt);

  const seenIds = new Set<string>();
  let previousIdentity: CanonicalPaginationIdentity | null = null;
  const rows = candidate.rows.map((row, index) => {
    const record = asRecord(row);
    if (!record) throw new Error(`Canonical Paper export row ${index} must be an object.`);
    if (record.runtime_id !== runtimeId) {
      throw new Error(`Canonical Paper export row ${index} runtime_id does not match ${runtimeId}.`);
    }

    const id = parseIdentityId(record.id, index);
    const idKey = `${typeof id}:${String(id)}`;
    if (seenIds.has(idKey)) {
      throw new Error(`Canonical Paper export contains duplicate row id ${String(id)}.`);
    }
    seenIds.add(idKey);

    const occurredAt = Date.parse(parseTimestamp(record.occurred_at, `Canonical Paper export row ${index} occurred_at`));
    const recordedAt = Date.parse(parseTimestamp(record.recorded_at, `Canonical Paper export row ${index} recorded_at`));
    if (snapshotRecordedAtMs !== null && recordedAt > snapshotRecordedAtMs) {
      throw new Error(`Canonical Paper export row ${index} recorded_at exceeds the frozen snapshot watermark.`);
    }

    const identity: CanonicalPaginationIdentity = { occurredAt, recordedAt, id };
    if (previousIdentity && comparePaginationIdentity(previousIdentity, identity) >= 0) {
      throw new Error(`Canonical Paper export row ${index} violates deterministic occurred_at/recorded_at/id pagination order.`);
    }
    previousIdentity = identity;

    return record as CanonicalPaperEventRow;
  });

  return {
    runtimeId,
    count: candidate.count,
    pages: candidate.pages,
    pageSize: candidate.pageSize,
    truncated: false,
    snapshotRecordedAt,
    snapshotFingerprint: candidate.snapshotFingerprint,
    rows,
  };
};

const assertMetric = (label: string, actual: number, expected: number) => {
  if (actual !== expected) {
    throw new Error(`Exact Paper protection baseline ${label} mismatch: baseline=${expected}, recomputed=${actual}.`);
  }
};

/**
 * Independently revalidates a saved exact-snapshot baseline against a saved
 * canonical export. This is intentionally offline: it opens no runtime, makes no
 * network request, and has no database/broker write path.
 *
 * Verification requires the canonical pagination identity to be complete and
 * monotonic, all three lineage anchors (runtime, frozen watermark, SHA-256
 * fingerprint) to agree, and diagnostic metrics to match a fresh replay of the
 * saved canonical rows. Historical-summary baselines cannot pass this gate.
 */
export const verifyPaperProtectionBaselineAgainstExport = async (
  exportValue: unknown,
  baselineValue: unknown,
): Promise<PaperProtectionBaselineVerificationResult> => {
  const exported = parseSavedCanonicalPaperEventExport(exportValue);
  const baseline: PaperProtectionEvidenceBaseline = parsePaperProtectionEvidenceBaseline(baselineValue);
  if (baseline.source.kind !== 'exact-snapshot') {
    throw new Error('Offline Paper protection verification requires an exact-snapshot baseline, not a historical summary.');
  }

  const recomputedFingerprint = await fingerprintCanonicalPaperEvents(
    exported.runtimeId,
    exported.snapshotRecordedAt,
    exported.rows,
  );
  if (recomputedFingerprint !== exported.snapshotFingerprint) {
    throw new Error(`Canonical Paper export fingerprint mismatch: declared=${exported.snapshotFingerprint}, recomputed=${recomputedFingerprint}.`);
  }
  if (baseline.source.runtimeId !== exported.runtimeId) {
    throw new Error(`Exact baseline runtime ${baseline.source.runtimeId} does not match export runtime ${exported.runtimeId}.`);
  }
  if (baseline.source.snapshotRecordedAt !== exported.snapshotRecordedAt) {
    throw new Error('Exact baseline snapshotRecordedAt does not match the saved canonical export watermark.');
  }
  if (baseline.source.snapshotFingerprint !== recomputedFingerprint) {
    throw new Error('Exact baseline snapshotFingerprint does not match the recomputed canonical export fingerprint.');
  }

  const diagnostic = buildPaperProtectionDiagnostic(exported.runtimeId, exported.rows);
  if (diagnostic.rejectedRows > 0) {
    throw new Error(`Canonical Paper export contains ${diagnostic.rejectedRows} replay-rejected row(s); exact baseline verification fails closed.`);
  }

  assertMetric('sourceRows', diagnostic.sourceRows, baseline.sourceRows);
  assertMetric('observations', diagnostic.observations, baseline.observations);
  assertMetric('changedExits', diagnostic.changedExits, baseline.changedExits);
  assertMetric('favorableOvershootRemoved', diagnostic.favorableOvershootRemoved, baseline.favorableOvershootRemoved);
  assertMetric('grossExitValueDelta', diagnostic.grossExitValueDelta, baseline.grossExitValueDelta);

  return {
    verified: true,
    runtimeId: exported.runtimeId,
    snapshotRecordedAt: exported.snapshotRecordedAt,
    snapshotFingerprint: recomputedFingerprint,
    sourceRows: diagnostic.sourceRows,
    observations: diagnostic.observations,
    changedExits: diagnostic.changedExits,
    favorableOvershootRemoved: diagnostic.favorableOvershootRemoved,
    grossExitValueDelta: diagnostic.grossExitValueDelta,
  };
};
