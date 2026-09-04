import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExperimentRouterEvidence } from './experimentRouter';
import type { ExperimentResult } from './experiment';

const result = (status: ExperimentResult['status']): ExperimentResult => ({
  experimentId: 'exp-1',
  runId: 'run-1',
  status,
  finishedAt: 10,
  metrics: [
    { metric: 'survivalProbability', value: 0.97, passed: true },
    { metric: 'maxDrawdownPct', value: 0.04, passed: true },
  ],
  rejectionReasons: [],
  decisionTraceIds: [],
  monteCarloSeed: 42,
});

test('fully validated candidate is eligible evidence but has no execution authority', () => {
  const evidence = buildExperimentRouterEvidence({
    candidateId: 'challenger-v2',
    experimentResult: result('PASSED'),
    monteCarloVerdict: 'PASS',
    reliabilityVerdict: 'PASS',
    currentRegime: 'RANGE',
    supportedRegimes: ['RANGE'],
  });

  assert.equal(evidence.disposition, 'ELIGIBLE');
  assert.equal(evidence.score, 100);
  assert.equal(evidence.executionAuthority, false);
});

test('regime mismatch preserves NO_TRADE as first-class disposition', () => {
  const evidence = buildExperimentRouterEvidence({
    candidateId: 'challenger-v2',
    experimentResult: result('PASSED'),
    monteCarloVerdict: 'PASS',
    reliabilityVerdict: 'PASS',
    currentRegime: 'DOWNTREND',
    supportedRegimes: ['RANGE', 'UPTREND'],
  });

  assert.equal(evidence.disposition, 'NO_TRADE');
  assert.equal(evidence.regimeSupported, false);
  assert.match(evidence.reasons.join(' '), /outside/);
});

test('weak validation becomes WATCH and hard failures become BLOCKED', () => {
  const watch = buildExperimentRouterEvidence({
    candidateId: 'challenger-v2',
    experimentResult: result('PASSED'),
    monteCarloVerdict: 'WATCH',
    reliabilityVerdict: 'EXTEND',
    currentRegime: 'RANGE',
    supportedRegimes: ['RANGE'],
  });
  assert.equal(watch.disposition, 'WATCH');
  assert.ok(watch.score < 100);

  const blocked = buildExperimentRouterEvidence({
    candidateId: 'challenger-v2',
    experimentResult: result('REJECTED'),
    monteCarloVerdict: 'REJECT',
    reliabilityVerdict: 'BLOCK',
    currentRegime: 'RANGE',
    supportedRegimes: ['RANGE'],
  });
  assert.equal(blocked.disposition, 'BLOCKED');
  assert.ok(blocked.reasons.length >= 3);
});
