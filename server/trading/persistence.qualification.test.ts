import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCheckpoint } from './persistence.ts';

const legacyCheckpoint = () => ({
  schemaVersion: 1 as const,
  savedAt: 1_780_000_000_000,
  reason: 'legacy',
  session: { schemaVersion: 1 },
  evidence: [],
  loop: { schemaVersion: 1 },
});

test('legacy schema-v1 checkpoint remains valid without qualification window', () => {
  const parsed = validateCheckpoint(legacyCheckpoint());
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.qualificationWindow, undefined);
});

test('qualification window is accepted as an optional schema-v1 extension', () => {
  const parsed = validateCheckpoint({
    ...legacyCheckpoint(),
    qualificationWindow: {
      schemaVersion: 1,
      id: 'paper-2026-09',
      armedAt: 1_780_000_000_000,
      startedAt: null,
      sourceRevision: 'abc123',
      startCycleStartedAt: null,
      startCycleFinishedAt: null,
      startEvidenceIds: [],
      status: 'ARMED',
      invalidationReasons: [],
      executionAuthority: false,
      promotionAuthority: false,
    },
  });
  assert.equal(parsed.qualificationWindow?.id, 'paper-2026-09');
});

test('malformed qualification window fails checkpoint validation without changing legacy schema rules', () => {
  assert.throws(() => validateCheckpoint({
    ...legacyCheckpoint(),
    qualificationWindow: { schemaVersion: 1, id: '', armedAt: 0, sourceRevision: '' },
  }), /qualification window checkpoint is incomplete/i);
});
