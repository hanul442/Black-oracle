import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPaperReadinessRating, type PaperReadinessRatingInput } from './paperReadinessRating.ts';

const strongInput = (): PaperReadinessRatingInput => ({
  evidenceCoverage: 1,
  auditAverage: 0.96,
  historicalVerdict: 'PASS',
  walkForwardVerdict: 'PASS',
  monteCarloVerdict: 'PASS',
  integrityCoverageDays: 14,
  integrityRequiredDays: 14,
  integrityCoverageComplete: true,
  fatalRuntimeIncidents: 0,
  unresolvedCriticalIncidents: 0,
  runtimeHealthy: true,
  closedTrades: 80,
  requiredClosedTrades: 60,
  observationDays: 16,
  requiredObservationDays: 14,
});

test('strong evidence-backed PAPER readiness can reach a high candidate grade but has no execution authority', () => {
  const rating = buildPaperReadinessRating(strongInput());
  assert.equal(rating.appliedGateKeys.length, 0);
  assert.equal(rating.executionAuthority, false);
  assert.ok(rating.rawScore > 95);
  assert.ok(['AAA+', 'AAA0', 'AAA-'].includes(rating.grade));
});

test('insufficient OOS/WF/MC sample caps readiness at BBB0', () => {
  const input = strongInput();
  input.historicalVerdict = 'INSUFFICIENT_DATA';
  input.walkForwardVerdict = 'INSUFFICIENT_DATA';
  input.monteCarloVerdict = 'INSUFFICIENT_DATA';
  input.closedTrades = 12;
  input.observationDays = 3;
  const rating = buildPaperReadinessRating(input);
  assert.ok(rating.appliedGateKeys.includes('historical-oos-pass'));
  assert.ok(rating.appliedGateKeys.includes('sample-depth'));
  assert.equal(rating.maxAllowedGrade, 'BBB0');
});

test('very weak evidence coverage imposes a B0 cap', () => {
  const input = strongInput();
  input.evidenceCoverage = 0.2;
  const rating = buildPaperReadinessRating(input);
  assert.equal(rating.maxAllowedGrade, 'B0');
  assert.ok(rating.appliedGateKeys.includes('evidence-coverage'));
});

test('fatal or unresolved critical incidents impose a CCC0 cap', () => {
  const input = strongInput();
  input.unresolvedCriticalIncidents = 1;
  const rating = buildPaperReadinessRating(input);
  assert.equal(rating.maxAllowedGrade, 'CCC0');
  assert.ok(rating.appliedGateKeys.includes('critical-incidents'));
});

test('runtime degradation cannot be hidden by strong research scores', () => {
  const input = strongInput();
  input.runtimeHealthy = false;
  const rating = buildPaperReadinessRating(input);
  assert.equal(rating.maxAllowedGrade, 'B0');
  assert.ok(rating.appliedGateKeys.includes('runtime-health'));
});
