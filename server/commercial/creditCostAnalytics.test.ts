import assert from 'node:assert/strict';
import test from 'node:test';

import { aggregateCreditActionCosts } from './creditCostAnalytics';

test('cost analytics groups multiple AI calls into one Credit job', () => {
  const stats = aggregateCreditActionCosts([
    { id: '1', estimated_cost_usd: 0.10, metadata: { creditActionType: 'REPORT_REFRESH', creditJobId: 'job-1' } },
    { id: '2', estimated_cost_usd: 0.20, metadata: { creditActionType: 'REPORT_REFRESH', creditJobId: 'job-1' } },
    { id: '3', estimated_cost_usd: 0.50, metadata: { creditActionType: 'REPORT_REFRESH', creditJobId: 'job-2' } },
  ]);

  assert.equal(stats.length, 1);
  assert.equal(stats[0].jobs, 2);
  assert.equal(stats[0].calls, 3);
  assert.equal(stats[0].totalCostUsd, 0.8);
  assert.equal(stats[0].plannedCredits, 500);
  assert.equal(stats[0].p50JobCostUsd, 0.4);
});

test('rows without a recognized Credit action are ignored', () => {
  const stats = aggregateCreditActionCosts([
    { id: '1', estimated_cost_usd: 1, metadata: {} },
    { id: '2', estimated_cost_usd: 1, metadata: { creditActionType: 'NOT_A_REAL_ACTION' } },
  ]);
  assert.deepEqual(stats, []);
});
