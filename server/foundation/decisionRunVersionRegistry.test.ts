import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECISION_RUN_CONTRACT_VERSION,
  VERSION_REGISTRY_CONTRACT_VERSION,
  createDecisionRunIdentity,
  fingerprintCanonicalValue,
  projectLegacyDecisionTrace,
  validateVersionRegistryRecord,
  type ComponentVersionRef,
} from './decisionRunVersionRegistry';

const versions: ComponentVersionRef[] = [
  {
    componentType: 'STRATEGY',
    componentId: 'krw-swing-router',
    versionId: 'strategy-v7',
    contentFingerprint: 'sha256:strategy-v7',
  },
  {
    componentType: 'RISK',
    componentId: 'hard-risk',
    versionId: 'risk-v3',
    contentFingerprint: 'sha256:risk-v3',
  },
];

test('Decision Run identity is deterministic across unordered reference inputs', () => {
  const a = createDecisionRunIdentity({
    runtimeId: 'paper-vnext',
    market: 'krw-btc',
    asOf: '2026-09-24T10:00:00Z',
    decisionKey: 'legacy-decision-1',
    componentVersions: versions,
    dataSnapshotIds: ['snapshot-b', 'snapshot-a'],
    evidenceIds: ['ev-2', 'ev-1', 'ev-1'],
  });

  const b = createDecisionRunIdentity({
    runtimeId: 'paper-vnext',
    market: 'KRW-BTC',
    asOf: '2026-09-24T10:00:00.000Z',
    decisionKey: 'legacy-decision-1',
    componentVersions: [...versions].reverse(),
    dataSnapshotIds: ['snapshot-a', 'snapshot-b'],
    evidenceIds: ['ev-1', 'ev-2'],
  });

  assert.equal(a.contractVersion, DECISION_RUN_CONTRACT_VERSION);
  assert.equal(a.decisionRunId, b.decisionRunId);
  assert.deepEqual(a.dataSnapshotIds, ['snapshot-a', 'snapshot-b']);
  assert.deepEqual(a.evidenceIds, ['ev-1', 'ev-2']);
});

test('Decision Run identity changes when a material component version changes', () => {
  const base = {
    runtimeId: 'paper-vnext',
    market: 'KRW-BTC',
    asOf: '2026-09-24T10:00:00Z',
    decisionKey: 'decision-1',
    dataSnapshotIds: ['snapshot-a'],
    evidenceIds: ['ev-1'],
  };

  const first = createDecisionRunIdentity({ ...base, componentVersions: versions });
  const second = createDecisionRunIdentity({
    ...base,
    componentVersions: versions.map((version) =>
      version.componentType === 'RISK'
        ? { ...version, versionId: 'risk-v4', contentFingerprint: 'sha256:risk-v4' }
        : version),
  });

  assert.notEqual(first.decisionRunId, second.decisionRunId);
});

test('Decision Run refuses to exist without explicit data snapshot and component versions', () => {
  assert.throws(() => createDecisionRunIdentity({
    runtimeId: 'paper-vnext',
    market: 'KRW-BTC',
    asOf: '2026-09-24T10:00:00Z',
    decisionKey: 'decision-1',
    componentVersions: [],
    dataSnapshotIds: ['snapshot-a'],
    evidenceIds: [],
  }), /component version/);

  assert.throws(() => createDecisionRunIdentity({
    runtimeId: 'paper-vnext',
    market: 'KRW-BTC',
    asOf: '2026-09-24T10:00:00Z',
    decisionKey: 'decision-1',
    componentVersions: versions,
    dataSnapshotIds: [],
    evidenceIds: [],
  }), /dataSnapshotId/);
});

test('Version Registry keeps Champion validation separate from Production deployment', () => {
  const championOffline = validateVersionRegistryRecord({
    contractVersion: VERSION_REGISTRY_CONTRACT_VERSION,
    componentType: 'CHAMPION',
    componentId: 'btc-regime-champion',
    versionId: 'champion-v2',
    contentFingerprint: 'sha256:champion-v2',
    createdAt: '2026-09-24T10:00:00Z',
    validationState: 'CHAMPION',
    deploymentState: 'OFFLINE',
  });

  assert.equal(championOffline.validationState, 'CHAMPION');
  assert.equal(championOffline.deploymentState, 'OFFLINE');
  assert.equal(championOffline.productionActivationId, null);

  assert.throws(() => validateVersionRegistryRecord({
    ...championOffline,
    deploymentState: 'PRODUCTION',
  }), /productionActivationId/);

  const production = validateVersionRegistryRecord({
    ...championOffline,
    deploymentState: 'PRODUCTION',
    productionActivationId: 'activation-2026-09-24-001',
  });
  assert.equal(production.validationState, 'CHAMPION');
  assert.equal(production.deploymentState, 'PRODUCTION');
  assert.equal(production.productionActivationId, 'activation-2026-09-24-001');
});

test('legacy trace adapter preserves useful lineage without inventing a Decision Run', () => {
  const projected = projectLegacyDecisionTrace({
    runtimeId: 'black-oracle-paper-s2-shadow',
    market: 'krw-eth',
    occurredAt: 1_788_930_000_000,
    traceId: 'black-oracle-paper-s2-shadow:KRW-ETH:1788930000000',
    decisionId: 'legacy-decision',
    strategyVersion: 's2-v4',
    evidenceIds: ['EV-2', 'EV-1'],
  });

  assert.equal(projected.status, 'LEGACY_TRACE_ONLY');
  assert.equal(projected.decisionRunId, null);
  assert.equal(projected.market, 'KRW-ETH');
  assert.deepEqual(projected.evidenceIds, ['EV-1', 'EV-2']);
  assert.ok(projected.missingForDecisionRun.includes('componentVersions'));
  assert.ok(projected.missingForDecisionRun.includes('dataSnapshotIds'));
});

test('canonical fingerprint is stable for object key order', () => {
  assert.equal(
    fingerprintCanonicalValue({ b: 2, a: { y: 2, x: 1 } }),
    fingerprintCanonicalValue({ a: { x: 1, y: 2 }, b: 2 }),
  );
});
