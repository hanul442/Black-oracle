import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRuntimeIntegrityReadModel } from './runtimeIntegrity';

const baseRuntimeHealth = {
  status: 'OK',
  now: 1_000_000,
  persistence: {
    configured: true,
    lastError: null,
    fault: false,
    lastSavedAt: 995_000,
    lastWriteDurationMs: 250,
    lastPayloadBytes: 100_000,
    lastRequestAttempts: 1,
    totalRetries: 0,
    lastHttpStatus: 201,
    profile: {
      qualificationMode: false,
      compatibility: null,
    },
  },
  loop: {
    running: true,
    cycleCount: 8,
    intervalMs: 900_000,
    lastCycleFinishedAt: 990_000,
    lastCycleErrors: 0,
    stale: false,
  },
};

const baseLedgerHealth = {
  status: 'HEALTHY',
  checkedAt: 1_000_000,
  scheduler: {
    status: 'HEALTHY',
    enabled: true,
    lastInvokedAt: 990_000,
    lastHttpStatus: 200,
    lastOk: true,
    lastError: null,
    ageMs: 10_000,
    controlPlaneDrift: false,
    reason: 'scheduler healthy',
  },
  producers: [
    { source: 'paper_runtime', lastSeenAt: 990_000, status: 'HEALTHY' },
    { source: 'nars_bridge', lastSeenAt: 980_000, status: 'IDLE' },
    { source: 'ai_council', lastSeenAt: 970_000, status: 'IDLE' },
  ],
  reasons: [],
};

const baseProfile = {
  runtimeId: 'black-oracle-paper',
  qualificationId: null,
  qualificationMode: false,
  systemRevision: 'abc123',
  strategyVersion: 'v1',
  riskConfigHash: 'risk123',
};

test('runtime integrity never turns unknown probes into a green aggregate', () => {
  const model = buildRuntimeIntegrityReadModel({
    runtimeHealth: baseRuntimeHealth,
    ledgerHealth: baseLedgerHealth,
    profile: baseProfile,
    gatewayObserved: true,
    deploymentRevision: 'abc123',
    now: 1_000_000,
  });

  assert.equal(model.status, 'DEGRADED');
  assert.equal(model.complete, false);
  assert.deepEqual(model.visibilityGaps.sort(), ['AI_COUNCIL', 'MARKET_DATA', 'NARS']);
  assert.equal(model.subsystems.find((item) => item.id === 'RUNTIME')?.status, 'OK');
  assert.equal(model.subsystems.find((item) => item.id === 'GATEWAY')?.status, 'OK');
  assert.equal(model.executionAuthority, false);
  assert.equal(model.qualificationAuthority, false);
});

test('persistence fault is critical even when runtime status was otherwise green', () => {
  const model = buildRuntimeIntegrityReadModel({
    runtimeHealth: {
      ...baseRuntimeHealth,
      persistence: {
        ...baseRuntimeHealth.persistence,
        fault: true,
        lastError: 'checkpoint write failed',
      },
    },
    ledgerHealth: baseLedgerHealth,
    profile: baseProfile,
    gatewayObserved: true,
    deploymentRevision: 'abc123',
    now: 1_000_000,
  });

  assert.equal(model.status, 'CRITICAL');
  assert.ok(model.criticalSubsystems.includes('PERSISTENCE'));
  assert.match(model.subsystems.find((item) => item.id === 'PERSISTENCE')?.reason ?? '', /checkpoint write failed/);
});

test('recovered persistence request remains degraded when latest write required retries', () => {
  const model = buildRuntimeIntegrityReadModel({
    runtimeHealth: {
      ...baseRuntimeHealth,
      persistence: {
        ...baseRuntimeHealth.persistence,
        lastError: null,
        fault: false,
        lastRequestAttempts: 3,
        totalRetries: 2,
        lastHttpStatus: 201,
      },
    },
    ledgerHealth: baseLedgerHealth,
    profile: baseProfile,
    gatewayObserved: true,
    deploymentRevision: 'abc123',
    now: 1_000_000,
  });

  const persistence = model.subsystems.find((item) => item.id === 'PERSISTENCE');
  assert.equal(persistence?.status, 'DEGRADED');
  assert.ok(model.degradedSubsystems.includes('PERSISTENCE'));
  assert.match(persistence?.reason ?? '', /3 attempts/);
});

test('scheduler control-plane drift is preserved in runtime integrity details', () => {
  const model = buildRuntimeIntegrityReadModel({
    runtimeHealth: baseRuntimeHealth,
    ledgerHealth: {
      ...baseLedgerHealth,
      status: 'DEGRADED',
      scheduler: {
        ...baseLedgerHealth.scheduler,
        status: 'DEGRADED',
        lastError: 'CONTROLLED_SINGLE_CYCLE_COMPLETE: recurring S2 scheduler remains intentionally disabled.',
        controlPlaneDrift: true,
        reason: 'Scheduler control-plane drift detected.',
      },
      reasons: ['Scheduler control-plane drift detected.'],
    },
    profile: baseProfile,
    gatewayObserved: true,
    deploymentRevision: 'abc123',
    now: 1_000_000,
  });

  const scheduler = model.subsystems.find((item) => item.id === 'SCHEDULER');
  assert.equal(scheduler?.status, 'DEGRADED');
  assert.equal(scheduler?.details?.controlPlaneDrift, true);
  assert.ok(model.degradedSubsystems.includes('SCHEDULER'));
});

test('armed qualification is green only after checkpoint identity is positively matched', () => {
  const model = buildRuntimeIntegrityReadModel({
    runtimeHealth: {
      ...baseRuntimeHealth,
      persistence: {
        ...baseRuntimeHealth.persistence,
        profile: {
          qualificationMode: true,
          compatibility: {
            status: 'MATCH',
            compatible: true,
            reasons: [],
          },
        },
      },
    },
    ledgerHealth: baseLedgerHealth,
    profile: {
      ...baseProfile,
      runtimeId: 'black-oracle-paper-vnext-s1r2',
      qualificationId: 's1r2',
      qualificationMode: true,
    },
    gatewayObserved: true,
    deploymentRevision: 'abc123',
    now: 1_000_000,
  });

  const qualification = model.subsystems.find((item) => item.id === 'QUALIFICATION');
  assert.equal(qualification?.status, 'OK');
  assert.equal(qualification?.authoritative, true);
  assert.equal(model.qualificationAuthority, false, 'health read model must never grant upgrade authority');
});

test('blocked qualification compatibility is surfaced as critical', () => {
  const model = buildRuntimeIntegrityReadModel({
    runtimeHealth: {
      ...baseRuntimeHealth,
      persistence: {
        ...baseRuntimeHealth.persistence,
        profile: {
          qualificationMode: true,
          compatibility: {
            status: 'BLOCKED',
            compatible: false,
            reasons: ['Risk configuration changed inside a pinned qualification runtime.'],
          },
        },
      },
    },
    ledgerHealth: baseLedgerHealth,
    profile: {
      ...baseProfile,
      runtimeId: 'black-oracle-paper-vnext-s1r2',
      qualificationId: 's1r2',
      qualificationMode: true,
    },
    gatewayObserved: true,
    deploymentRevision: 'abc123',
    now: 1_000_000,
  });

  assert.equal(model.status, 'CRITICAL');
  assert.ok(model.criticalSubsystems.includes('QUALIFICATION'));
  assert.match(model.subsystems.find((item) => item.id === 'QUALIFICATION')?.reason ?? '', /Risk configuration changed/);
});
