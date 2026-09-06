import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyEmpiricalPaperReport, buildEmpiricalAccumulationHealth, scopeEmpiricalInputToQualificationWindow, type EmpiricalAccumulationInput } from './empiricalValidation.ts';

const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);
const INTERVAL = 15 * 60_000;
const HOUR = 60 * 60_000;

const cycle = (finishedAt: number, errors = 0) => ({
  startedAt: finishedAt - 60_000,
  finishedAt,
  scanned: 6,
  entered: 0,
  exited: 0,
  held: 2,
  noTrade: 4,
  errors: Array.from({ length: errors }, () => ({ error: 'x' })),
  markets: Array.from({ length: 6 }, (_, index) => ({ evidenceIds: index < 5 ? [`ev-${index}`] : [] })),
});

const baseInput = (): EmpiricalAccumulationInput => ({
  now: NOW,
  intervalMs: INTERVAL,
  cycleHistory: Array.from({ length: 16 }, (_, index) => cycle(NOW - (15 - index) * INTERVAL)),
  validationSamples: Array.from({ length: 12 }, (_, index) => ({ decisionTimestamp: NOW - index * INTERVAL, targetTimestamp: NOW - index * INTERVAL })),
  councilComparisons: Array.from({ length: 12 }, (_, index) => ({ generatedAt: NOW - index * INTERVAL, resolvedAt: NOW - index * INTERVAL })),
  strategyObservations: Array.from({ length: 24 }, (_, index) => ({ generatedAt: NOW - index * INTERVAL, resolvedAt: NOW - index * INTERVAL })),
  strategyAlignedObservations: 24,
  minimumPboObservations: 60,
  experimentEvents: [{ timestamp: NOW - HOUR, type: 'EXPERIMENT_STARTED' }],
  gradeHistory: Array.from({ length: 10 }, (_, index) => ({ timestamp: NOW - index * INTERVAL, rating: { grade: 'BBB0', rawScore: 72, appliedGateKeys: ['OOS'] } })),
  closedTrades: Array.from({ length: 10 }, (_, index) => ({ openedAt: NOW - index * INTERVAL - HOUR, closedAt: NOW - index * INTERVAL, returnPct: 0.01, netPnl: 100 })),
});

test('empirical health fails closed when there is no runtime history', () => {
  const input = baseInput();
  input.cycleHistory = [];
  const report = buildEmpiricalAccumulationHealth(input);
  assert.equal(report.disposition, 'INSUFFICIENT_DATA');
  assert.equal(report.operationalGates.find((gate) => gate.key === 'RUNTIME_RECENCY')?.status, 'FAIL');
});

test('healthy runtime remains COLLECTING while empirical sample gates are incomplete', () => {
  const report = buildEmpiricalAccumulationHealth(baseInput());
  assert.equal(report.disposition, 'COLLECTING');
  assert.equal(report.runtime.cycleErrorRate24h, 0);
  assert.equal(report.samples.strategyAligned, 24);
  assert.equal(report.samples.pboEtaHours != null, true);
  assert.equal(report.sampleGates.find((gate) => gate.key === 'PBO_ALIGNED_OBSERVATIONS')?.status, 'WAIT');
});

test('stale runtime is marked STALLED regardless of research sample depth', () => {
  const input = baseInput();
  input.cycleHistory = [cycle(NOW - INTERVAL * 4)];
  input.strategyAlignedObservations = 60;
  input.councilComparisons = Array.from({ length: 40 }, () => ({ generatedAt: NOW - HOUR, resolvedAt: NOW - HOUR }));
  input.closedTrades = Array.from({ length: 60 }, () => ({ openedAt: NOW - HOUR * 2, closedAt: NOW - HOUR, returnPct: 0.01, netPnl: 10 }));
  input.gradeHistory = Array.from({ length: 24 }, (_, index) => ({ timestamp: NOW - index * INTERVAL, rating: { grade: 'A0', rawScore: 86 } }));
  const report = buildEmpiricalAccumulationHealth(input);
  assert.equal(report.disposition, 'STALLED');
});

test('fully satisfied operational and sample gates can become HEALTHY', () => {
  const input = baseInput();
  input.strategyAlignedObservations = 60;
  input.councilComparisons = Array.from({ length: 30 }, (_, index) => ({ generatedAt: NOW - index * INTERVAL, resolvedAt: NOW - index * INTERVAL }));
  input.closedTrades = Array.from({ length: 60 }, (_, index) => ({ openedAt: NOW - index * INTERVAL - HOUR, closedAt: NOW - index * INTERVAL, returnPct: 0.01, netPnl: 10 }));
  input.gradeHistory = Array.from({ length: 24 }, (_, index) => ({ timestamp: NOW - index * INTERVAL, rating: { grade: 'A0', rawScore: 86 } }));
  const report = buildEmpiricalAccumulationHealth(input);
  assert.equal(report.disposition, 'HEALTHY');
  assert.equal(report.sampleGates.every((gate) => gate.status === 'PASS'), true);
});

test('daily report uses KST-local calendar day and preserves evidence linkage', () => {
  const report = buildDailyEmpiricalPaperReport(baseInput());
  assert.equal(report.date, '2026-09-06');
  assert.equal(report.cycles.count, 16);
  assert.equal(report.evidence.decisions, 96);
  assert.equal(report.evidence.linkedDecisions, 80);
  assert.equal(report.outcomes.netPnl, 1000);
  assert.equal(report.executionAuthority, false);
});

test('qualification scope removes all legacy samples when window has not started', () => {
  const scoped = scopeEmpiricalInputToQualificationWindow(baseInput(), null);
  assert.equal(scoped.cycleHistory.length, 0);
  assert.equal(scoped.strategyAlignedObservations, 0);
  assert.equal(scoped.closedTrades.length, 0);
});

test('qualification scope rejects a trade opened before the window even if it closes after start', () => {
  const start = NOW - HOUR;
  const input = baseInput();
  input.closedTrades = [
    { openedAt: start - 1, closedAt: start + INTERVAL, returnPct: 0.01, netPnl: 10 },
    { openedAt: start + 1, closedAt: start + INTERVAL, returnPct: 0.02, netPnl: 20 },
  ];
  input.strategyObservations = [
    { generatedAt: start - 1, resolvedAt: start + INTERVAL },
    { generatedAt: start + 1, resolvedAt: start + INTERVAL },
  ];
  input.strategyAlignedObservations = 2;
  const scoped = scopeEmpiricalInputToQualificationWindow(input, start);
  assert.equal(scoped.closedTrades.length, 1);
  assert.equal(scoped.closedTrades[0]?.netPnl, 20);
  assert.equal(scoped.strategyObservations.length, 1);
  assert.equal(scoped.strategyAlignedObservations, 1);
});
