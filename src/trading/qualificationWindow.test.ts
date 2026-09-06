import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceQualificationWindow, createQualificationWindow, normalizeQualificationWindowConfig } from './qualificationWindow.ts';
import type { TradingEvidence } from './evidence.ts';

const ARMED_AT = Date.UTC(2026, 8, 6, 3, 0, 0);
const config = normalizeQualificationWindowConfig({ id: 'paper-2026-09', armedAt: ARMED_AT, sourceRevision: 'abc123' })!;
const cycle = {
  startedAt: ARMED_AT + 15 * 60_000,
  finishedAt: ARMED_AT + 16 * 60_000,
  scanned: 6,
  errors: [],
  markets: [{ evidenceIds: ['ev-1'] }],
};
const evidence = (overrides: Partial<TradingEvidence> = {}): TradingEvidence => ({
  id: 'ev-1',
  market: 'KRW-BTC',
  title: 'Source-backed event',
  direction: 'NEUTRAL',
  strength: 60,
  reliability: 0.9,
  sourceType: 'NEWS',
  sourceUrl: 'https://example.com/evidence',
  observedAt: ARMED_AT + 5 * 60_000,
  expiresAt: ARMED_AT + 24 * 60 * 60_000,
  ...overrides,
});

test('qualification window remains ARMED without source-backed evidence', () => {
  const window = advanceQualificationWindow({ existing: createQualificationWindow(config), config, latestCycle: cycle, evidence: [] });
  assert.equal(window?.status, 'ARMED');
  assert.equal(window?.startedAt, null);
});

test('unreferenced evidence cannot start a qualification window', () => {
  const window = advanceQualificationWindow({
    existing: createQualificationWindow(config),
    config,
    latestCycle: { ...cycle, markets: [{ evidenceIds: ['other'] }] },
    evidence: [evidence()],
  });
  assert.equal(window?.status, 'ARMED');
});

test('SYSTEM or provenance-free evidence cannot start qualification', () => {
  const system = advanceQualificationWindow({ existing: createQualificationWindow(config), config, latestCycle: cycle, evidence: [evidence({ sourceType: 'SYSTEM' })] });
  const noUrl = advanceQualificationWindow({ existing: createQualificationWindow(config), config, latestCycle: cycle, evidence: [evidence({ sourceUrl: undefined })] });
  assert.equal(system?.startedAt, null);
  assert.equal(noUrl?.startedAt, null);
});

test('clean cycle using fresh source-backed evidence starts at cycle start', () => {
  const window = advanceQualificationWindow({ existing: createQualificationWindow(config), config, latestCycle: cycle, evidence: [evidence()] });
  assert.equal(window?.status, 'COLLECTING');
  assert.equal(window?.startedAt, cycle.startedAt);
  assert.deepEqual(window?.startEvidenceIds, ['ev-1']);
  assert.equal(window?.sourceRevision, 'abc123');
});

test('cycle with market errors cannot start qualification', () => {
  const window = advanceQualificationWindow({ existing: createQualificationWindow(config), config, latestCycle: { ...cycle, errors: [{ market: 'KRW-BTC' }] }, evidence: [evidence()] });
  assert.equal(window?.status, 'ARMED');
});

test('started window is immutable across later qualifying cycles', () => {
  const started = advanceQualificationWindow({ existing: createQualificationWindow(config), config, latestCycle: cycle, evidence: [evidence()] })!;
  const later = advanceQualificationWindow({
    existing: started,
    config,
    latestCycle: { ...cycle, startedAt: cycle.startedAt + 60_000, finishedAt: cycle.finishedAt + 60_000 },
    evidence: [evidence({ id: 'ev-2', observedAt: ARMED_AT + 6 * 60_000 })],
  });
  assert.equal(later?.startedAt, started.startedAt);
  assert.deepEqual(later?.startEvidenceIds, started.startEvidenceIds);
});

test('configuration mismatch invalidates qualification credit instead of shifting the window', () => {
  const existing = createQualificationWindow(config);
  const changed = normalizeQualificationWindowConfig({ ...config, sourceRevision: 'different' })!;
  const window = advanceQualificationWindow({ existing, config: changed, latestCycle: cycle, evidence: [evidence()] });
  assert.equal(window?.status, 'INVALIDATED');
  assert.equal(window?.startedAt, null);
  assert.match(window?.invalidationReasons[0] ?? '', /does not match configured/);
});
