import {
  replayCanonicalPaperProtectionEvents,
  type CanonicalPaperEventRow,
  type CanonicalPaperProtectionReplayResult,
} from './canonicalPaperProtectionReplay';

export interface PaperProtectionDiagnostic {
  runtimeId: string;
  sourceRows: number;
  acceptedRows: number;
  rejectedRows: number;
  rejectionReasons: Record<string, number>;
  observations: number;
  skippedSellFills: number;
  byTrigger: CanonicalPaperProtectionReplayResult['report']['summary']['byTrigger'];
  favorableOvershootRemoved: number;
  grossExitValueDelta: number;
  changedExits: number;
  lineage: Array<{
    ledgerEventId: string;
    ledgerSequence: number;
    timestamp: number;
    market: string;
    strategyVersion: string;
    trigger: string;
    triggerPrice: number;
    observedPrice: number;
    quantity: number;
  }>;
}

/**
 * Produces a compact, read-only operator report from canonical event rows.
 *
 * This projection intentionally contains no broker/session/execution hooks and
 * cannot mutate Paper or Production state. It preserves source ledger lineage
 * for every classified protection exit so the report remains auditable.
 */
export const buildPaperProtectionDiagnostic = (
  runtimeId: string,
  rows: CanonicalPaperEventRow[],
): PaperProtectionDiagnostic => {
  const replay = replayCanonicalPaperProtectionEvents(runtimeId, rows);
  const changedExits = replay.report.replays.filter(({ counterfactual }) =>
    Math.abs(counterfactual.grossExitValueDelta) > Number.EPSILON,
  ).length;

  return {
    runtimeId,
    sourceRows: rows.length,
    acceptedRows: replay.acceptedRows,
    rejectedRows: replay.rejectedRows,
    rejectionReasons: { ...replay.rejectionReasons },
    observations: replay.report.summary.observations,
    skippedSellFills: replay.report.skippedSellFills,
    byTrigger: { ...replay.report.summary.byTrigger },
    favorableOvershootRemoved: replay.report.summary.favorableOvershootRemoved,
    grossExitValueDelta: replay.report.summary.grossExitValueDelta,
    changedExits,
    lineage: replay.report.observations.map((observation) => ({
      ledgerEventId: observation.ledgerEventId,
      ledgerSequence: observation.ledgerSequence,
      timestamp: observation.timestamp,
      market: observation.market,
      strategyVersion: observation.strategyVersion,
      trigger: observation.trigger,
      triggerPrice: observation.triggerPrice,
      observedPrice: observation.observedPrice,
      quantity: observation.quantity,
    })),
  };
};
