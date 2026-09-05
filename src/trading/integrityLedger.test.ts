import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendIntegrityEvent,
  buildIncidentOpenedEvent,
  buildIncidentTransitionEvent,
  createIntegrityLedgerCheckpoint,
  deriveIntegrityIncidents,
  summarizeIntegrityLedger,
} from './integrityLedger';

const DAY = 86_400_000;

test('zero incidents remain unavailable until the full observability window is covered', () => {
  const startedAt = 1_000_000;
  const ledger = createIntegrityLedgerCheckpoint(startedAt);
  const early = summarizeIntegrityLedger(ledger, startedAt + 13 * DAY, 14);
  assert.equal(early.coverageComplete, false);
  assert.equal(early.dailyRiskBreaches, null);
  assert.equal(early.unresolvedCriticalIncidents, null);

  const mature = summarizeIntegrityLedger(ledger, startedAt + 14 * DAY, 14);
  assert.equal(mature.coverageComplete, true);
  assert.equal(mature.dailyRiskBreaches, 0);
  assert.equal(mature.riskBypasses, 0);
  assert.equal(mature.unresolvedCriticalIncidents, 0);
});

test('critical incident stays unresolved after acknowledgement and clears only after resolution', () => {
  const startedAt = 1_000_000;
  let ledger = createIntegrityLedgerCheckpoint(startedAt);
  const opened = buildIncidentOpenedEvent({
    timestamp: startedAt + DAY,
    kind: 'RISK_BYPASS',
    severity: 'CRITICAL',
    dedupeKey: 'risk-bypass:KRW-BTC:1',
    message: 'ENTER executed without deterministic Risk approval.',
    market: 'KRW-BTC',
    cycleNumber: 10,
  });
  ledger = appendIntegrityEvent(ledger, opened);
  let incident = deriveIntegrityIncidents(ledger)[0];
  assert.equal(incident.status, 'UNACKNOWLEDGED');

  ledger = appendIntegrityEvent(ledger, buildIncidentTransitionEvent({
    incident,
    type: 'INCIDENT_ACKNOWLEDGED',
    actor: 'operator-1',
    note: 'Investigating.',
    timestamp: startedAt + DAY + 1_000,
  }));
  incident = deriveIntegrityIncidents(ledger)[0];
  assert.equal(incident.status, 'ACKNOWLEDGED');

  let summary = summarizeIntegrityLedger(ledger, startedAt + 15 * DAY, 14);
  assert.equal(summary.riskBypasses, 1);
  assert.equal(summary.unresolvedCriticalIncidents, 1);

  ledger = appendIntegrityEvent(ledger, buildIncidentTransitionEvent({
    incident,
    type: 'INCIDENT_RESOLVED',
    actor: 'operator-1',
    note: 'Root cause fixed and regression test added.',
    timestamp: startedAt + DAY + 2_000,
  }));
  summary = summarizeIntegrityLedger(ledger, startedAt + 15 * DAY, 14);
  assert.equal(summary.riskBypasses, 1, 'resolved incidents remain in historical counts');
  assert.equal(summary.unresolvedCriticalIncidents, 0);
});

test('event appends are idempotent by event id', () => {
  let ledger = createIntegrityLedgerCheckpoint(1_000_000);
  const event = buildIncidentOpenedEvent({
    timestamp: 2_000_000,
    kind: 'EXECUTION_INTEGRITY',
    severity: 'CRITICAL',
    dedupeKey: 'execution-integrity:KRW-BTC:2',
    message: 'Execution integrity fault.',
  });
  ledger = appendIntegrityEvent(ledger, event);
  ledger = appendIntegrityEvent(ledger, event);
  assert.equal(ledger.events.filter((item) => item.id === event.id).length, 1);
});
