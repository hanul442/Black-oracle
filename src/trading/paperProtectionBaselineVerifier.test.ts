import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintCanonicalPaperEvents } from './canonicalPaperEventFingerprint';
import type { CanonicalPaperEventRow } from './canonicalPaperProtectionReplay';
import { buildPaperProtectionDiagnostic } from './paperProtectionDiagnostic';
import {
  verifyPaperProtectionBaselineAgainstExport,
} from './paperProtectionBaselineVerifier';

const runtimeId = 'black-oracle-paper-vnext-100m-v03';
const snapshotRecordedAt = '2026-09-14T00:00:00.000Z';

const row = (
  sequence: number,
  ledgerType: 'POSITION_UPDATED' | 'ORDER_FILLED',
  payload: Record<string, unknown>,
): CanonicalPaperEventRow => ({
  id: `canonical-${sequence.toString().padStart(4, '0')}`,
  runtime_id: runtimeId,
  occurred_at: new Date(sequence * 1_000).toISOString(),
  recorded_at: new Date(sequence * 1_000 + 100).toISOString(),
  event_name: ledgerType,
  strategy_version: 'BO-UNIFIED-v0.3.0',
  trace: {
    payload,
    sequence,
    ledgerType,
    ledgerEventId: `ledger-${sequence}`,
    strategyVersion: 'BO-UNIFIED-v0.3.0',
  },
});

const rows = (): CanonicalPaperEventRow[] => [
  row(1, 'POSITION_UPDATED', {
    market: 'KRW-TEST',
    position: {
      market: 'KRW-TEST',
      quantity: 10,
      initialQuantity: 10,
      averageCost: 100,
      entryPrice: 100,
      openedAt: 1,
      updatedAt: 1,
      stopLossPrice: 95,
      takeProfitPrice: 120,
      takeProfit1Price: 105,
      takeProfit2Price: 120,
      takeProfit1Fraction: 0.4,
      takeProfit1Taken: false,
      protectionBasis: 'ATR',
      protectionRevision: 0,
    },
  }),
  row(2, 'ORDER_FILLED', {
    market: 'KRW-TEST',
    side: 'SELL',
    quantity: 4,
    fillPrice: 109.912,
    slippageBps: 8,
    partialExit: true,
    timestamp: 2_000,
  }),
];

const buildArtifacts = async () => {
  const canonicalRows = rows();
  const fingerprint = await fingerprintCanonicalPaperEvents(runtimeId, snapshotRecordedAt, canonicalRows);
  const diagnostic = buildPaperProtectionDiagnostic(runtimeId, canonicalRows);
  return {
    exported: {
      runtimeId,
      count: canonicalRows.length,
      pages: 1,
      pageSize: 500,
      truncated: false,
      snapshotRecordedAt,
      snapshotFingerprint: fingerprint,
      rows: canonicalRows,
    },
    baseline: {
      source: {
        kind: 'exact-snapshot',
        runtimeId,
        snapshotRecordedAt,
        snapshotFingerprint: fingerprint,
      },
      sourceRows: diagnostic.sourceRows,
      observations: diagnostic.observations,
      favorableOvershootRemoved: diagnostic.favorableOvershootRemoved,
      grossExitValueDelta: diagnostic.grossExitValueDelta,
      changedExits: diagnostic.changedExits,
    },
  };
};

test('verifies lineage fingerprint pagination identity and replayed metrics for a saved exact baseline', async () => {
  const { exported, baseline } = await buildArtifacts();
  const result = await verifyPaperProtectionBaselineAgainstExport(exported, baseline);

  assert.equal(result.verified, true);
  assert.equal(result.runtimeId, runtimeId);
  assert.equal(result.snapshotRecordedAt, snapshotRecordedAt);
  assert.equal(result.snapshotFingerprint, exported.snapshotFingerprint);
  assert.equal(result.sourceRows, 2);
  assert.equal(result.observations, 1);
  assert.equal(result.changedExits, 1);
});

test('rejects a tampered saved export before it can validate a baseline', async () => {
  const { exported, baseline } = await buildArtifacts();
  const tampered = structuredClone(exported);
  (tampered.rows[1]?.trace as { payload?: { fillPrice?: number } }).payload!.fillPrice = 120;

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport(tampered, baseline),
    /export fingerprint mismatch/,
  );
});

test('rejects metric drift even when exact snapshot lineage still matches', async () => {
  const { exported, baseline } = await buildArtifacts();
  const drifted = structuredClone(baseline);
  drifted.changedExits += 1;

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport(exported, drifted),
    /changedExits mismatch/,
  );
});

test('rejects historical summaries, truncated artifacts, and cross-runtime rows', async () => {
  const { exported, baseline } = await buildArtifacts();

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport(exported, {
      ...baseline,
      source: { kind: 'historical-summary', label: 'legacy summary' },
    }),
    /requires an exact-snapshot baseline/,
  );

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport({ ...exported, truncated: true }, baseline),
    /must be complete/,
  );

  const crossRuntime = structuredClone(exported);
  crossRuntime.rows[0]!.runtime_id = 'other-runtime';
  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport(crossRuntime, baseline),
    /runtime_id does not match/,
  );
});

test('rejects duplicate canonical row ids even when an artifact can be re-fingerprinted', async () => {
  const { exported, baseline } = await buildArtifacts();
  const duplicateRows = structuredClone(exported.rows);
  duplicateRows[1]!.id = duplicateRows[0]!.id;
  const fingerprint = await fingerprintCanonicalPaperEvents(runtimeId, snapshotRecordedAt, duplicateRows);
  const duplicateExport = {
    ...exported,
    snapshotFingerprint: fingerprint,
    rows: duplicateRows,
  };
  const duplicateBaseline = {
    ...baseline,
    source: { ...baseline.source, snapshotFingerprint: fingerprint },
  };

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport(duplicateExport, duplicateBaseline),
    /duplicate row id/,
  );
});

test('rejects non-monotonic occurred_at recorded_at id pagination identity', async () => {
  const { exported, baseline } = await buildArtifacts();
  const unorderedRows = structuredClone(exported.rows).reverse();
  const fingerprint = await fingerprintCanonicalPaperEvents(runtimeId, snapshotRecordedAt, unorderedRows);
  const unorderedExport = {
    ...exported,
    snapshotFingerprint: fingerprint,
    rows: unorderedRows,
  };
  const unorderedBaseline = {
    ...baseline,
    source: { ...baseline.source, snapshotFingerprint: fingerprint },
  };

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport(unorderedExport, unorderedBaseline),
    /violates deterministic occurred_at\/recorded_at\/id pagination order/,
  );
});

test('rejects missing pagination identity and rows beyond the frozen watermark', async () => {
  const { exported, baseline } = await buildArtifacts();

  const missingIdentity = structuredClone(exported);
  delete missingIdentity.rows[0]!.id;
  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport(missingIdentity, baseline),
    /requires a stable id/,
  );

  const beyondWatermarkRows = structuredClone(exported.rows);
  beyondWatermarkRows[1]!.recorded_at = '2026-09-14T00:00:00.001Z';
  const fingerprint = await fingerprintCanonicalPaperEvents(runtimeId, snapshotRecordedAt, beyondWatermarkRows);
  const beyondWatermarkExport = {
    ...exported,
    snapshotFingerprint: fingerprint,
    rows: beyondWatermarkRows,
  };
  const beyondWatermarkBaseline = {
    ...baseline,
    source: { ...baseline.source, snapshotFingerprint: fingerprint },
  };

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport(beyondWatermarkExport, beyondWatermarkBaseline),
    /recorded_at exceeds the frozen snapshot watermark/,
  );
});

test('fails closed when replay rejects a canonical row even if the artifact fingerprint is internally consistent', async () => {
  const { exported, baseline } = await buildArtifacts();
  const malformedRows = structuredClone(exported.rows);
  malformedRows.push({
    id: 'canonical-0003',
    runtime_id: runtimeId,
    occurred_at: '2026-09-13T23:59:59.000Z',
    recorded_at: '2026-09-13T23:59:59.100Z',
    event_name: 'POSITION_UPDATED',
    strategy_version: 'BO-UNIFIED-v0.3.0',
    trace: null,
  });
  malformedRows.sort((left, right) => Date.parse(String(left.occurred_at)) - Date.parse(String(right.occurred_at)));
  const fingerprint = await fingerprintCanonicalPaperEvents(runtimeId, snapshotRecordedAt, malformedRows);
  const malformedExport = {
    ...exported,
    count: malformedRows.length,
    pages: 1,
    snapshotFingerprint: fingerprint,
    rows: malformedRows,
  };
  const diagnostic = buildPaperProtectionDiagnostic(runtimeId, malformedRows);
  const malformedBaseline = {
    ...baseline,
    source: { ...baseline.source, snapshotFingerprint: fingerprint },
    sourceRows: diagnostic.sourceRows,
    observations: diagnostic.observations,
    favorableOvershootRemoved: diagnostic.favorableOvershootRemoved,
    grossExitValueDelta: diagnostic.grossExitValueDelta,
    changedExits: diagnostic.changedExits,
  };

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport(malformedExport, malformedBaseline),
    /replay-rejected row/,
  );
});

test('rejects page-count metadata that cannot describe the exported row set', async () => {
  const { exported, baseline } = await buildArtifacts();

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport({ ...exported, pages: 2 }, baseline),
    /page cardinality mismatch/,
  );

  await assert.rejects(
    () => verifyPaperProtectionBaselineAgainstExport({ ...exported, pageSize: 1 }, baseline),
    /page cardinality mismatch/,
  );
});
