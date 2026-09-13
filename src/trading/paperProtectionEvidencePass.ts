import {
  exportCanonicalPaperEvents,
  type CanonicalPaperEventExportOptions,
} from './canonicalPaperEventExport';
import {
  buildPaperProtectionDiagnostic,
  type PaperProtectionDiagnostic,
} from './paperProtectionDiagnostic';

export type PaperProtectionEvidenceBaselineSource =
  | {
      kind: 'exact-snapshot';
      runtimeId: string;
      snapshotRecordedAt: string | null;
      snapshotFingerprint: string;
    }
  | {
      kind: 'historical-summary';
      label: string;
    };

export interface PaperProtectionEvidenceBaseline {
  source: PaperProtectionEvidenceBaselineSource;
  sourceRows: number;
  observations: number;
  favorableOvershootRemoved: number;
  grossExitValueDelta: number;
  changedExits: number;
}

export interface PaperProtectionEvidenceComparison {
  baselineSourceKind: PaperProtectionEvidenceBaselineSource['kind'];
  sameSnapshot: boolean | null;
  sourceRowsDelta: number;
  observationsDelta: number;
  favorableOvershootRemovedDelta: number;
  grossExitValueDeltaDelta: number;
  changedExitsDelta: number;
}

export interface PaperProtectionEvidencePassResult {
  runtimeId: string;
  export: {
    rows: number;
    pages: number;
    pageSize: number;
    truncated: false;
    snapshotRecordedAt: string | null;
    snapshotFingerprint: string;
  };
  diagnostic: PaperProtectionDiagnostic;
  baseline: PaperProtectionEvidenceBaseline | null;
  comparison: PaperProtectionEvidenceComparison | null;
}

export interface PaperProtectionEvidencePassOptions
  extends Omit<CanonicalPaperEventExportOptions, 'runtimeId'> {
  runtimeId: string;
  baseline?: PaperProtectionEvidenceBaseline | null;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isSnapshotFingerprint = (value: unknown): value is string =>
  typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);

/**
 * Validates JSON-loaded evidence baselines before they can influence a comparison.
 * Baselines must declare whether they are exact frozen snapshots or historical
 * summaries; legacy/unlabelled artifacts fail closed instead of being silently
 * treated as equivalent qualification evidence.
 */
export const parsePaperProtectionEvidenceBaseline = (
  value: unknown,
): PaperProtectionEvidenceBaseline => {
  if (!value || typeof value !== 'object') {
    throw new Error('Paper protection baseline must be a JSON object.');
  }

  const candidate = value as Record<string, unknown>;
  const sourceRows = candidate.sourceRows;
  const observations = candidate.observations;
  const favorableOvershootRemoved = candidate.favorableOvershootRemoved;
  const grossExitValueDelta = candidate.grossExitValueDelta;
  const changedExits = candidate.changedExits;

  if (!isNonNegativeInteger(sourceRows)
      || !isNonNegativeInteger(observations)
      || !isFiniteNumber(favorableOvershootRemoved)
      || !isFiniteNumber(grossExitValueDelta)
      || !isNonNegativeInteger(changedExits)) {
    throw new Error('Paper protection baseline contains invalid diagnostic metrics.');
  }

  const source = candidate.source;
  if (!source || typeof source !== 'object') {
    throw new Error('Paper protection baseline must declare source provenance.');
  }

  const sourceCandidate = source as Record<string, unknown>;
  if (sourceCandidate.kind === 'exact-snapshot') {
    const sourceRuntimeId = sourceCandidate.runtimeId;
    const rawSnapshotRecordedAt = sourceCandidate.snapshotRecordedAt;
    const snapshotFingerprint = sourceCandidate.snapshotFingerprint;

    if (typeof sourceRuntimeId !== 'string' || !sourceRuntimeId.trim()) {
      throw new Error('Exact-snapshot baseline requires runtimeId.');
    }

    let snapshotRecordedAt: string | null;
    if (rawSnapshotRecordedAt === null) {
      snapshotRecordedAt = null;
    } else if (typeof rawSnapshotRecordedAt === 'string') {
      snapshotRecordedAt = rawSnapshotRecordedAt;
    } else {
      throw new Error('Exact-snapshot baseline snapshotRecordedAt must be a string or null.');
    }

    if (!isSnapshotFingerprint(snapshotFingerprint)) {
      throw new Error('Exact-snapshot baseline requires a canonical sha256 snapshotFingerprint.');
    }

    return {
      source: {
        kind: 'exact-snapshot',
        runtimeId: sourceRuntimeId.trim(),
        snapshotRecordedAt,
        snapshotFingerprint,
      },
      sourceRows,
      observations,
      favorableOvershootRemoved,
      grossExitValueDelta,
      changedExits,
    };
  }

  if (sourceCandidate.kind === 'historical-summary') {
    const label = sourceCandidate.label;
    if (typeof label !== 'string' || !label.trim()) {
      throw new Error('Historical-summary baseline requires a non-empty label.');
    }

    return {
      source: {
        kind: 'historical-summary',
        label: label.trim(),
      },
      sourceRows,
      observations,
      favorableOvershootRemoved,
      grossExitValueDelta,
      changedExits,
    };
  }

  throw new Error('Paper protection baseline source.kind must be exact-snapshot or historical-summary.');
};

/**
 * Executes one read-only evidence pass from a frozen canonical Paper snapshot
 * to the protection diagnostic. A capped/truncated export is rejected rather
 * than being presented as complete qualification evidence.
 */
export const runPaperProtectionEvidencePass = async (
  options: PaperProtectionEvidencePassOptions,
): Promise<PaperProtectionEvidencePassResult> => {
  const exported = await exportCanonicalPaperEvents(options);
  if (exported.truncated) {
    throw new Error(
      `Canonical Paper evidence export was truncated at ${exported.rows.length} rows; increase maxRows before using this as qualification evidence.`,
    );
  }

  const diagnostic = buildPaperProtectionDiagnostic(exported.runtimeId, exported.rows);
  const baseline = options.baseline ?? null;
  if (baseline?.source.kind === 'exact-snapshot'
      && baseline.source.runtimeId !== exported.runtimeId) {
    throw new Error(
      `Exact-snapshot baseline runtime ${baseline.source.runtimeId} does not match evidence runtime ${exported.runtimeId}.`,
    );
  }

  const comparison = baseline
    ? {
        baselineSourceKind: baseline.source.kind,
        sameSnapshot: baseline.source.kind === 'exact-snapshot'
          ? baseline.source.snapshotFingerprint === exported.snapshotFingerprint
          : null,
        sourceRowsDelta: diagnostic.sourceRows - baseline.sourceRows,
        observationsDelta: diagnostic.observations - baseline.observations,
        favorableOvershootRemovedDelta:
          diagnostic.favorableOvershootRemoved - baseline.favorableOvershootRemoved,
        grossExitValueDeltaDelta:
          diagnostic.grossExitValueDelta - baseline.grossExitValueDelta,
        changedExitsDelta: diagnostic.changedExits - baseline.changedExits,
      }
    : null;

  return {
    runtimeId: exported.runtimeId,
    export: {
      rows: exported.rows.length,
      pages: exported.pages,
      pageSize: exported.pageSize,
      truncated: false,
      snapshotRecordedAt: exported.snapshotRecordedAt,
      snapshotFingerprint: exported.snapshotFingerprint,
    },
    diagnostic,
    baseline,
    comparison,
  };
};
