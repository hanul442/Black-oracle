import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScheduledRuntimeAuthority } from './runtimeAuthority';

const railwayEnv = {
  RAILWAY_SERVICE_NAME: 'black-oracle-paper-vnext',
  RAILWAY_SERVICE_ID: 'svc-vnext',
  RAILWAY_DEPLOYMENT_ID: 'dep-123',
  RAILWAY_GIT_COMMIT_SHA: 'abc123',
  RAILWAY_REPLICA_ID: 'replica-1',
  RAILWAY_PUBLIC_DOMAIN: 'black-oracle-paper-vnext-production.up.railway.app',
};

test('scheduled runtime authority binds delegated runtime to the configured Railway writer', () => {
  const authority = buildScheduledRuntimeAuthority(
    'black-oracle-paper-vnext-100m-v03',
    'black-oracle-paper-vnext-100m-v03',
    'black-oracle-paper-vnext',
    'cycle-123',
    railwayEnv,
  );

  assert.equal(authority.schemaVersion, 1);
  assert.equal(authority.cycleId, 'cycle-123');
  assert.equal(authority.delegatedRuntimeId, 'black-oracle-paper-vnext-100m-v03');
  assert.equal(authority.producer.serviceName, 'black-oracle-paper-vnext');
  assert.equal(authority.producer.serviceId, 'svc-vnext');
  assert.equal(authority.producer.deploymentId, 'dep-123');
  assert.equal(authority.producer.gitCommitSha, 'abc123');
  assert.match(authority.leaseOwner, /^scheduled-worker:black-oracle-paper-vnext:dep-123:cycle-123$/);
});

test('scheduled runtime authority rejects logical runtime drift before lease acquisition', () => {
  assert.throws(
    () => buildScheduledRuntimeAuthority(
      'black-oracle-paper-vnext-100m-v03',
      'black-oracle-paper-vnext-s1r2',
      'black-oracle-paper-vnext',
      'cycle-123',
      railwayEnv,
    ),
    /does not match configured runtime/,
  );
});

test('scheduled runtime authority rejects the wrong physical Railway service', () => {
  assert.throws(
    () => buildScheduledRuntimeAuthority(
      'black-oracle-paper-vnext-100m-v03',
      'black-oracle-paper-vnext-100m-v03',
      'black-oracle-paper-vnext',
      'cycle-123',
      { ...railwayEnv, RAILWAY_SERVICE_NAME: 'black-oracle-web' },
    ),
    /is not authorized for runtime/,
  );
});
