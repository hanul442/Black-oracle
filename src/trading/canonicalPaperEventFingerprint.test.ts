import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprintCanonicalPaperEvents } from './canonicalPaperEventFingerprint';

const runtimeId = 'black-oracle-paper-vnext-100m-v03';
const snapshotRecordedAt = '2026-09-13T00:10:00.000Z';

test('produces a stable sha256 fingerprint across object key ordering', async () => {
  const left = [{
    runtime_id: runtimeId,
    occurred_at: '2026-09-13T00:00:01Z',
    event_name: 'POSITION_UPDATED',
    strategy_version: 'v1',
    trace: { sequence: 1, nested: { b: 2, a: 1 } },
  }];
  const right = [{
    trace: { nested: { a: 1, b: 2 }, sequence: 1 },
    strategy_version: 'v1',
    event_name: 'POSITION_UPDATED',
    occurred_at: '2026-09-13T00:00:01Z',
    runtime_id: runtimeId,
  }];

  const leftFingerprint = await fingerprintCanonicalPaperEvents(runtimeId, snapshotRecordedAt, left);
  const rightFingerprint = await fingerprintCanonicalPaperEvents(runtimeId, snapshotRecordedAt, right);

  assert.match(leftFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.equal(leftFingerprint, rightFingerprint);
});

test('changes when canonical input or frozen watermark changes', async () => {
  const rows = [{
    runtime_id: runtimeId,
    occurred_at: '2026-09-13T00:00:01Z',
    event_name: 'POSITION_UPDATED',
    strategy_version: 'v1',
    trace: { sequence: 1 },
  }];

  const baseline = await fingerprintCanonicalPaperEvents(runtimeId, snapshotRecordedAt, rows);
  const changedRow = await fingerprintCanonicalPaperEvents(runtimeId, snapshotRecordedAt, [
    { ...rows[0], trace: { sequence: 2 } },
  ]);
  const changedWatermark = await fingerprintCanonicalPaperEvents(runtimeId, '2026-09-13T00:11:00.000Z', rows);

  assert.notEqual(baseline, changedRow);
  assert.notEqual(baseline, changedWatermark);
});
