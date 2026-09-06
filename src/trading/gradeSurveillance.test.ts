import assert from 'node:assert/strict';
import test from 'node:test';
import { appendGradeSnapshot, summarizeGradeSurveillance } from './gradeSurveillance.ts';
import { buildOracleRating } from './rating.ts';

const snapshot = (timestamp: number, score: number) => ({
  timestamp,
  scope: 'PAPER_READINESS' as const,
  rating: buildOracleRating([{ key: 'score', label: 'Score', score, weight: 1, confidence: 1 }]),
  sourceCheckpointSavedAt: timestamp - 1,
  executionAuthority: false as const,
});

test('persists ordered grade snapshots and summarizes downgrade velocity', () => {
  let checkpoint = appendGradeSnapshot(undefined, snapshot(1000, 96));
  checkpoint = appendGradeSnapshot(checkpoint, snapshot(2000, 85));
  checkpoint = appendGradeSnapshot(checkpoint, snapshot(3000, 72));

  const summary = summarizeGradeSurveillance(checkpoint);
  assert.equal(checkpoint.history.length, 3);
  assert.equal(summary.current?.rating.grade, 'BBB+');
  assert.equal(summary.previous?.rating.grade, 'AA0');
  assert.equal(summary.trend, 'DOWN');
  assert.equal(summary.consecutiveDowngrades, 2);
  assert.equal(summary.downgradeEvents, 2);
  assert.equal(summary.executionAuthority, false);
});

test('replaces duplicate timestamp instead of creating ambiguous history', () => {
  let checkpoint = appendGradeSnapshot(undefined, snapshot(1000, 90));
  checkpoint = appendGradeSnapshot(checkpoint, snapshot(1000, 40));
  assert.equal(checkpoint.history.length, 1);
  assert.equal(checkpoint.history[0].rating.rawScore, 40);
});

test('coalesces insignificant same-grade autosave snapshots inside fifteen minutes', () => {
  let checkpoint = appendGradeSnapshot(undefined, snapshot(1_000_000, 90));
  checkpoint = appendGradeSnapshot(checkpoint, snapshot(1_060_000, 91));
  assert.equal(checkpoint.history.length, 1);
});

test('upgrade resets consecutive downgrade count', () => {
  let checkpoint = appendGradeSnapshot(undefined, snapshot(1000, 70));
  checkpoint = appendGradeSnapshot(checkpoint, snapshot(2000, 60));
  checkpoint = appendGradeSnapshot(checkpoint, snapshot(3000, 80));
  const summary = summarizeGradeSurveillance(checkpoint);
  assert.equal(summary.trend, 'UP');
  assert.equal(summary.consecutiveDowngrades, 0);
  assert.equal(summary.downgradeEvents, 1);
});
