import assert from 'node:assert/strict';
import test from 'node:test';
import { assessStrategyDrift, strategyRegimeTotalVariation, type StrategyDriftWindow } from './strategyDrift';

const START = Date.parse('2026-08-01T00:00:00.000Z');
const DAY = 86_400_000;

const window = (overrides: Partial<StrategyDriftWindow> = {}): StrategyDriftWindow => ({
  genomeId: 'genome-g1-test',
  startedAt: START,
  endedAt: START + 14 * DAY,
  samples: 40,
  expectancyReturn: 0.005,
  maxDrawdownPct: 0.02,
  regimeCounts: { UPTREND: 20, RANGE: 15, DOWNTREND: 5 },
  parity: {
    policyObserved: 40, policyRejected: 0,
    targetObserved: 40, targetRejected: 0,
    adapterObserved: 10, adapterRejected: 0,
  },
  ...overrides,
});

const recent = (overrides: Partial<StrategyDriftWindow> = {}): StrategyDriftWindow => window({
  startedAt: START + 15 * DAY,
  endedAt: START + 29 * DAY,
  expectancyReturn: 0.0045,
  maxDrawdownPct: 0.025,
  regimeCounts: { UPTREND: 19, RANGE: 16, DOWNTREND: 5 },
  ...overrides,
});

test('stable recent behavior produces observation-only continuation', () => {
  const result = assessStrategyDrift(window(), recent());
  assert.equal(result.verdict, 'STABLE');
  assert.equal(result.recommendation, 'CONTINUE_OBSERVATION');
  assert.equal(result.automaticDemotion, false);
  assert.equal(result.executionAuthority, false);
  assert.equal(result.promotionAuthority, false);
  assert.equal(result.capitalAuthority, false);
});

test('moderate expectancy deterioration produces WATCH and extended validation, not demotion', () => {
  const result = assessStrategyDrift(window(), recent({ expectancyReturn: 0.0035 }));
  assert.equal(result.metrics.expectancyDropBps, 15);
  assert.equal(result.verdict, 'WATCH');
  assert.equal(result.recommendation, 'EXTEND_VALIDATION');
  assert.equal(result.automaticDemotion, false);
});

test('one recent parity mismatch is a degraded governance signal but still only requests review', () => {
  const result = assessStrategyDrift(window(), recent({
    parity: {
      policyObserved: 40, policyRejected: 0,
      targetObserved: 40, targetRejected: 0,
      adapterObserved: 10, adapterRejected: 1,
    },
  }));
  assert.equal(result.verdict, 'DEGRADED');
  assert.equal(result.recommendation, 'DEMOTION_REVIEW');
  assert.equal(result.metrics.parityMismatches, 1);
  assert.equal(result.automaticDemotion, false);
});

test('large drawdown expansion independently triggers degraded review', () => {
  const result = assessStrategyDrift(window(), recent({ maxDrawdownPct: 0.045 }));
  assert.equal(result.verdict, 'DEGRADED');
  assert.ok(result.reasons.some((reason) => reason.includes('DRAWDOWN_DRIFT')));
});

test('insufficient observation depth never fabricates drift confidence', () => {
  const result = assessStrategyDrift(window({ samples: 10 }), recent({ samples: 12 }));
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
  assert.equal(result.recommendation, 'EXTEND_VALIDATION');
  assert.equal(result.metrics.expectancyDropBps, null);
  assert.equal(result.metrics.drawdownExpansionPct, null);
});

test('regime total variation handles categories appearing in only one window', () => {
  const distance = strategyRegimeTotalVariation({ UPTREND: 100 }, { DOWNTREND: 100 });
  assert.equal(distance, 1);
  const same = strategyRegimeTotalVariation({ UPTREND: 70, RANGE: 30 }, { UPTREND: 70, RANGE: 30 });
  assert.equal(same, 0);
});
