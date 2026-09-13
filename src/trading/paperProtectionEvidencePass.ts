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
  Number.isInteger(value) && Number(value) >= 0;

const assertFingerprint = (value: unknown): asserts value is string => {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    throw new Error('Exact-snapshot baseline requires a canonical sha256 snapshotFingerprint.');
  }
};

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
  if (!isNonNegativeInteger(candidate.sourceRows)
      || !isNonNegativeInteger(candidate.observations)
      || !isFiniteNumber(candidate.favorableOvershootRemoved)
      || !isFiniteNumber(candidate.grossExitValueDelta)
      || !isNonNegativeInteger(candidate.changedExits)) {
    throw new Error('Paper protection baseline contains invalid diagnostic metrics.');
  }

  const source = candidate.source;
  if (!source || typeof source !== 'object') {
    throw new Error('Paper protection baseline must declare source provenance.');
  }

  const sourceCandidate = source as Record<string, unknown>;
  if (sourceCandidate.kind === 'exact-snapshot') {
    if (typeof sourceCandidate.runtimeId !== 'string' || !sourceCandidate.runtimeId.trim()) {
      throw new Error('Exact-snapshot baseline requires runtimeId.');
    }
    if (sourceCandidate.snapshotRecordedAt !== null
        && typeof sourceCandidate.snapshotRecordedAt !== 'string') {
      throw new Error('Exact-snapshot baseline snapshotRecordedAt must be a string or null.');
    }
    assertFingerprint(sourceCandidate.snapshotFingerprint);

    return {
      source: {
        kind: 'exact-snapshot',
        runtimeId: sourceCandidate.runtimeId.trim(),
        snapshotRecordedAt: sourceCandidate.snapshotRecordedAt as string | null,
        snapshotFingerprint: sourceCandidate.snapshotFingerprint,
      },
      sourceRows: candidate.sourceRows,
      observations: candidate.observations,
      favorableOvershootRemoved: candidate.favorableOvershootRemoved,
      grossExitValueDelta: candidate.grossExitValueDelta,
      changedExits: candidate.changedExits,
    };
  }

  if (sourceCandidate.kind === 'historical-summary') {
    if (typeof sourceCandidate.label !== 'string' || !sourceCandidate.label.trim()) {
      throw new Error('Historical-summary baseline requires a non-empty label.');
    }

    return {
      source: {
        kind: 'historical-summary',
        label: sourceCandidate.label.trim(),
      },
      sourceRows: candidate.sourceRows,
      observations: candidate.observations,
      favorableOvershootRemoved: candidate.favorableOvershootRemoved,
      grossExitValueDelta: candidate.grossExitValueDelta,
      changedExits: candidate.changedExits,
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
