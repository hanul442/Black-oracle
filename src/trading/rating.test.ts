import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOracleRating,
  deploymentStatusForGrade,
  gradeFromScore,
  ratingTrend,
} from './rating.ts';

test('maps scores to explicit plus/zero/minus grade notation', () => {
  assert.equal(gradeFromScore(99), 'AAA+');
  assert.equal(gradeFromScore(96), 'AAA0');
  assert.equal(gradeFromScore(94), 'AAA-');
  assert.equal(gradeFromScore(90), 'AA0');
  assert.equal(gradeFromScore(84), 'A0');
  assert.equal(gradeFromScore(76), 'BBB0');
  assert.equal(gradeFromScore(67), 'BB0');
  assert.equal(gradeFromScore(49), 'CCC0');
  assert.equal(gradeFromScore(20), 'D0');
  assert.equal(gradeFromScore(5), 'F0');
  assert.equal(gradeFromScore(0), 'F-');
});

test('calculates weighted score, coverage and confidence separately', () => {
  const rating = buildOracleRating([
    { key: 'oos', label: 'OOS', score: 90, weight: 2, confidence: 0.9, required: true },
    { key: 'risk', label: 'Risk', score: 80, weight: 1, confidence: 0.8, required: true },
    { key: 'calibration', label: 'Calibration', score: null, weight: 1, required: false },
  ]);
  assert.equal(Math.round(rating.rawScore * 100) / 100, 86.67);
  assert.equal(rating.grade, 'A+');
  assert.equal(rating.coverage, 0.75);
  assert.equal(Math.round(rating.confidenceScore * 1000) / 1000, 0.65);
  assert.equal(rating.confidence, 'MEDIUM');
  assert.equal(rating.executionAuthority, false);
});

test('hard gates cap otherwise strong grades', () => {
  const rating = buildOracleRating(
    [{ key: 'performance', label: 'Performance', score: 99, weight: 1, confidence: 1 }],
    [{ key: 'no-oos', passed: false, maxGrade: 'BBB0', reason: 'Out-of-sample validation is missing.' }],
  );
  assert.equal(rating.baseGrade, 'AAA+');
  assert.equal(rating.grade, 'BBB0');
  assert.equal(rating.deploymentStatus, 'INCUBATOR');
});

test('multiple failed gates use the strictest cap', () => {
  const rating = buildOracleRating(
    [{ key: 'performance', label: 'Performance', score: 99, weight: 1 }],
    [
      { key: 'gate-a', passed: false, maxGrade: 'A0', reason: 'A cap' },
      { key: 'gate-b', passed: false, maxGrade: 'B0', reason: 'B cap' },
    ],
  );
  assert.equal(rating.grade, 'B0');
});

test('tracks upgrades and downgrades from latest historical grade', () => {
  assert.equal(ratingTrend('AA0', [{ timestamp: 1, grade: 'A0' }]), 'UP');
  assert.equal(ratingTrend('BBB0', [{ timestamp: 1, grade: 'A0' }]), 'DOWN');
  assert.equal(ratingTrend('AA0', [{ timestamp: 1, grade: 'AA0' }]), 'STABLE');
  assert.equal(ratingTrend('AA0', []), 'NEW');
});

test('maps grades to non-authoritative deployment states', () => {
  assert.equal(deploymentStatusForGrade('AAA-'), 'CHAMPION_CANDIDATE');
  assert.equal(deploymentStatusForGrade('A+'), 'CHALLENGER');
  assert.equal(deploymentStatusForGrade('BBB0'), 'INCUBATOR');
  assert.equal(deploymentStatusForGrade('BB0'), 'EXPERIMENT');
  assert.equal(deploymentStatusForGrade('CCC0'), 'REJECT');
  assert.equal(deploymentStatusForGrade('D0'), 'RETIRED');
});
