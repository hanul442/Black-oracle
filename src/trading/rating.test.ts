import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOracleRating,
  deploymentStatusForGrade,
  gradeFromScore,
  ratingTrend,
} from './rating.ts';

test('maps the approved grade scale', () => {
  assert.equal(gradeFromScore(98), 'AAA+');
  assert.equal(gradeFromScore(94), 'AAA');
  assert.equal(gradeFromScore(73), 'A-');
  assert.equal(gradeFromScore(68), 'BBB');
  assert.equal(gradeFromScore(53), 'CCC');
  assert.equal(gradeFromScore(38), 'D+');
  assert.equal(gradeFromScore(0), 'F-');
});

test('calculates weighted score, coverage and confidence separately', () => {
  const rating = buildOracleRating([
    { key: 'oos', label: 'OOS', score: 90, weight: 2, confidence: 0.9, required: true },
    { key: 'risk', label: 'Risk', score: 80, weight: 1, confidence: 0.8, required: true },
    { key: 'calibration', label: 'Calibration', score: null, weight: 1, required: false },
  ]);
  assert.equal(Math.round(rating.rawScore * 100) / 100, 86.67);
  assert.equal(rating.grade, 'AA');
  assert.equal(rating.coverage, 0.75);
  assert.equal(Math.round(rating.confidenceScore * 1000) / 1000, 0.65);
  assert.equal(rating.confidence, 'MEDIUM');
});

test('hard gates cap otherwise strong grades', () => {
  const rating = buildOracleRating(
    [{ key: 'performance', label: 'Performance', score: 99, weight: 1, confidence: 1 }],
    [{ key: 'no-oos', passed: false, maxGrade: 'BBB', reason: 'Out-of-sample validation is missing.' }],
  );
  assert.equal(rating.baseGrade, 'AAA+');
  assert.equal(rating.grade, 'BBB');
  assert.equal(rating.deploymentStatus, 'INCUBATOR');
});

test('multiple failed gates use the strictest cap', () => {
  const rating = buildOracleRating(
    [{ key: 'performance', label: 'Performance', score: 99, weight: 1 }],
    [
      { key: 'gate-a', passed: false, maxGrade: 'A', reason: 'A cap' },
      { key: 'gate-b', passed: false, maxGrade: 'B', reason: 'B cap' },
    ],
  );
  assert.equal(rating.grade, 'B');
});

test('tracks upgrades and downgrades from the latest historical grade', () => {
  assert.equal(ratingTrend('AA', [{ timestamp: 1, grade: 'A' }]), 'UP');
  assert.equal(ratingTrend('BBB', [{ timestamp: 1, grade: 'A' }]), 'DOWN');
  assert.equal(ratingTrend('AA', [{ timestamp: 1, grade: 'AA' }]), 'STABLE');
  assert.equal(ratingTrend('AA', []), 'NEW');
});

test('maps grades to deployment states', () => {
  assert.equal(deploymentStatusForGrade('AAA-'), 'CHAMPION');
  assert.equal(deploymentStatusForGrade('A+'), 'CHALLENGER');
  assert.equal(deploymentStatusForGrade('BBB'), 'INCUBATOR');
  assert.equal(deploymentStatusForGrade('BB'), 'EXPERIMENT');
  assert.equal(deploymentStatusForGrade('CCC'), 'REJECT');
  assert.equal(deploymentStatusForGrade('D+'), 'RETIRED');
});
