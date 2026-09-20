import assert from 'node:assert/strict';
import test from 'node:test';

import { hasEntitlement } from './entitlements';

test('Core sees preview but not full debate', () => {
  assert.equal(hasEntitlement('CORE', 'VIEW_REPORT_PREVIEW'), true);
  assert.equal(hasEntitlement('CORE', 'VIEW_FULL_DEBATE'), false);
});

test('Plus unlocks full debate and Alerts but not forecast', () => {
  assert.equal(hasEntitlement('PLUS', 'VIEW_FULL_DEBATE'), true);
  assert.equal(hasEntitlement('PLUS', 'USE_ALERTS'), true);
  assert.equal(hasEntitlement('PLUS', 'VIEW_FORECAST'), false);
});

test('Pro unlocks full report and forecast but not new report requests', () => {
  assert.equal(hasEntitlement('PRO', 'VIEW_FULL_REPORT'), true);
  assert.equal(hasEntitlement('PRO', 'VIEW_FORECAST'), true);
  assert.equal(hasEntitlement('PRO', 'REQUEST_NEW_REPORT'), false);
});

test('Max can direct research', () => {
  assert.equal(hasEntitlement('MAX', 'REQUEST_NEW_REPORT'), true);
  assert.equal(hasEntitlement('MAX', 'USE_SCHEDULED_RESEARCH'), true);
});
