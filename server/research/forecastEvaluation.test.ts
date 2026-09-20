import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluatePublishedForecast } from './forecastEvaluation';
import type { ReportForecast } from '../../src/report/contracts';

const forecast: ReportForecast = {
  forecastId: 'f1',
  reportId: 'r1',
  reportVersion: 1,
  publishedAt: 1000,
  asOf: 1000,
  horizonLabel: '3D',
  horizonEndAt: 4000,
  scenarios: [
    { label: 'BULL', targetPrice: 120, currency: 'KRW', probability: 0.25, rationale: '' },
    { label: 'BASE', targetPrice: 110, currency: 'KRW', probability: 0.5, rationale: '' },
    { label: 'BEAR', targetPrice: 90, currency: 'KRW', probability: 0.25, rationale: '' },
  ],
  supportZones: [],
  resistanceZones: [],
  invalidationConditions: [],
  status: 'ACTIVE',
};

test('forecast evaluation preserves direction and base target error', () => {
  const result = evaluatePublishedForecast({
    forecast,
    evaluatedAt: 5000,
    observations: [
      { timestamp: 1000, high: 101, low: 99, close: 100 },
      { timestamp: 2000, high: 107, low: 100, close: 106 },
      { timestamp: 4000, high: 112, low: 105, close: 111 },
    ],
  });

  assert.equal(result.directionResult, 'CORRECT');
  assert.equal(Math.round((result.baseTargetAbsoluteErrorPct ?? 0) * 10000), 91);
  assert.equal(result.actualHighPrice, 112);
});

test('forecast evaluation fails closed with insufficient observations', () => {
  const result = evaluatePublishedForecast({
    forecast,
    observations: [{ timestamp: 1000, high: 101, low: 99, close: 100 }],
  });

  assert.equal(result.directionResult, 'NOT_EVALUABLE');
  assert.equal(result.baseTargetAbsoluteErrorPct, null);
});
