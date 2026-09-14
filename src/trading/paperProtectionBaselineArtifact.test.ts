import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExactPaperProtectionEvidenceBaseline,
  parsePaperProtectionEvidenceBaseline,
  type PaperProtectionEvidencePassResult,
} from './paperProtectionEvidencePass';

const runtimeId = 'black-oracle-paper-vnext-100m-v03';
const snapshotRecordedAt = '2026-09-14T00:00:00.000Z';
const snapshotFingerprint = `sha256:${'b'.repeat(64)}`;

const evidenceResult: PaperProtectionEvidencePassResult = {
  runtimeId,
  export: {
    rows: 2089,
    pages: 5,
    pageSize: 500,
    truncated: false,
    snapshotRecordedAt,
    snapshotFingerprint,
  },
  diagnostic: {
    runtimeId,
    sourceRows: 2089,
    observations: 11,
    stopLossObservations: 8,
    takeProfit1Observations: 2,
    takeProfit2Observations: 1,
    changedExits: 3,
    favorableOvershootRemoved: 351520.92,
    grossExitValueDelta: -351239.7,
    rows: [],
  },
  baseline: null,
  comparison: null,
};

test('promotes a validated evidence result into an exact-snapshot baseline without losing lineage', () => {
  const baseline = buildExactPaperProtectionEvidenceBaseline(evidenceResult);

  assert.deepEqual(baseline, {
    source: {
      kind: 'exact-snapshot',
      runtimeId,
      snapshotRecordedAt,
      snapshotFingerprint,
    },
    sourceRows: 2089,
    observations: 11,
    favorableOvershootRemoved: 351520.92,
    grossExitValueDelta: -351239.7,
    changedExits: 3,
  });

  assert.deepEqual(parsePaperProtectionEvidenceBaseline(baseline), baseline);
});

test('exact baseline artifact excludes mutable comparison context', () => {
  const baseline = buildExactPaperProtectionEvidenceBaseline({
    ...evidenceResult,
    baseline: {
      source: { kind: 'historical-summary', label: 'older summary' },
      sourceRows: 100,
      observations: 2,
      favorableOvershootRemoved: 10,
      grossExitValueDelta: -5,
      changedExits: 1,
    },
    comparison: {
      baselineSourceKind: 'historical-summary',
      sameSnapshot: null,
      sourceRowsDelta: 1989,
      observationsDelta: 9,
      favorableOvershootRemovedDelta: 351510.92,
      grossExitValueDeltaDelta: -351234.7,
      changedExitsDelta: 2,
    },
  });

  assert.equal('comparison' in baseline, false);
  assert.equal('baseline' in baseline, false);
  assert.equal(baseline.source.kind, 'exact-snapshot');
});
