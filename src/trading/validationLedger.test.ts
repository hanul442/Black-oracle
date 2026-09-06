import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeValidationSamples, summarizeValidationSamples } from './validationLedger';
import type { BlindValidationSample } from './blindValidation';

const sample = (timestamp: number, action: BlindValidationSample['action'], directionalReturn = 0.01): BlindValidationSample => ({
  market: 'KRW-BTC',
  decisionTimestamp: timestamp,
  anchorTimestamp: timestamp,
  targetTimestamp: timestamp + 4 * 60 * 60_000,
  action,
  regime: 'UPTREND',
  anchorPrice: 100,
  targetPrice: 101,
  rawReturn: action === 'EXIT' ? -directionalReturn : directionalReturn,
  directionalReturn,
  favorable: directionalReturn > 0,
});

test('promotion ledger keeps ENTER/EXIT and excludes repeated HOLD observations', () => {
  const merged = mergeValidationSamples([], [sample(1, 'ENTER'), sample(2, 'HOLD'), sample(3, 'EXIT')]);
  assert.deepEqual(merged.map((item) => item.action), ['ENTER', 'EXIT']);
});

test('ledger deduplicates the same evaluated execution sample', () => {
  const item = sample(1, 'ENTER');
  const merged = mergeValidationSamples([item], [item]);
  assert.equal(merged.length, 1);
});

test('summary remains insufficient until both sample and observation requirements pass', () => {
  const items = Array.from({ length: 20 }, (_, index) => sample(1_000_000 + index * 86_400_000, index % 2 ? 'EXIT' : 'ENTER'));
  const result = summarizeValidationSamples(items, { minSamples: 60, minObservationDays: 14 });
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
  assert.equal(result.sampleCount, 20);
  assert.ok(result.observationDays >= 14);
});
