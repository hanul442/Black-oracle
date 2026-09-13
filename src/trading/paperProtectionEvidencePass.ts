import {
  exportCanonicalPaperEvents,
  type CanonicalPaperEventExportOptions,
} from './canonicalPaperEventExport';
import {
  buildPaperProtectionDiagnostic,
  type PaperProtectionDiagnostic,
} from './paperProtectionDiagnostic';

export interface PaperProtectionEvidenceBaseline {
  sourceRows: number;
  observations: number;
  favorableOvershootRemoved: number;
  grossExitValueDelta: number;
  changedExits: number;
}

export interface PaperProtectionEvidenceComparison {
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
  const comparison = baseline
    ? {
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
    },
    diagnostic,
    baseline,
    comparison,
  };
};
