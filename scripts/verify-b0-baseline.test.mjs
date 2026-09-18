import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateB0Baseline } from './verify-b0-baseline.mjs';

const fixture = () => JSON.parse(readFileSync(new URL('../ops/b0-baseline.json', import.meta.url), 'utf8'));

test('B0 baseline validates without claiming release readiness', () => {
  const result = validateB0Baseline(fixture());
  assert.equal(result.contractValid, true);
  assert.equal(result.releaseReady, false);
  assert.equal(result.b0Status, 'IN_PROGRESS');
  assert.ok(result.unresolved.length > 0);
});

for (const [name, change] of [
  ['live trading', m => { m.policy.tradingMode = 'LIVE'; }],
  ['Report order dependency', m => { m.policy.reportRequiredForOrder = true; }],
  ['Report execution authority', m => { m.policy.reportCanAuthorizeExecution = true; }],
  ['research evidence promoted without revalidation', m => { m.policy.executionEvidenceRequiresRevalidation = false; }],
  ['Risk sovereignty removed', m => { m.policy.deterministicRiskSovereign = false; }],
  ['historical mutation enabled', m => { m.policy.historicalAuditMutation = 'ALLOWED'; }],
  ['performance streams collapsed', m => { m.policy.performanceStreams = ['PAPER']; }],
  ['missing performance fabricated', m => { m.policy.missingPerformance = 0; }],
  ['capacity becomes entitlement', m => { m.policy.capacityChangesEntitlements = true; }],
  ['Credit locks risk', m => { m.policy.creditSafetyExemptSurfaces = m.policy.creditSafetyExemptSurfaces.filter(x => x !== 'RISK'); }],
  ['false B0 completion', m => { m.b0Status = 'VERIFIED'; }],
  ['invented runtime health', m => { m.railway.services[0].runtimeHealth = 'HEALTHY'; }],
  ['missing production service', m => { m.railway.services.pop(); }],
  ['malformed deployment SHA', m => { m.railway.services[0].deploymentSha = 'main'; }],
  ['vNext mismatch hidden', m => {
    const v = m.railway.services.find(s => s.name === 'black-oracle-paper-vnext');
    v.configuredSha = v.deploymentSha;
  }],
  ['v03 owner rewritten', m => {
    const owner = m.runtimeOwners.find(s => s.runtimeId === 'black-oracle-paper-vnext-100m-v03');
    owner.ownerService = 'black-oracle-paper-vnext';
  }],
  ['readiness invented from deployment success', m => {
    m.operationalObservations = m.operationalObservations.filter(s => s.state !== 'NOT_READY');
  }],
  ['legacy destructive grants hidden', m => { m.storageAuthority.serviceRoleDestructiveTables = 0; }],
  ['browser table access introduced', m => { m.storageAuthority.browserGrantedTables = 1; }],
  ['beta namespace invented', m => { m.storageAuthority.betaWriteNamespace.exists = true; }],
  ['legacy mutation denial invented', m => { m.storageAuthority.betaWriteNamespace.legacyMutationDeniedByDatabase = true; }],
  ['B0.3 enforcement invented', m => { m.storageAuthority.betaWriteNamespace.enforcementStatus = 'ENFORCED'; }],
  ['public status auth review invented', m => {
    const status = m.storageAuthority.edgeFunctionsWithoutJwt.find(f => f.name === 'black-oracle-runtime-status');
    status.reviewStatus = 'VERIFIED_FAIL_CLOSED';
  }],
  ['security invoker gap hidden', m => { m.storageAuthority.viewsWithoutSecurityInvoker = []; }],
  ['HTTP 409 promoted to ready', m => { m.runtimeReadinessContract.http409Ready = true; }],
  ['scheduler heartbeat substitutes for checkpoint', m => { m.runtimeReadinessContract.schedulerHeartbeatCanRefreshCheckpoint = true; }],
  ['UNKNOWN promoted to ready', m => { m.runtimeReadinessContract.unknownReady = true; }],
  ['internal qualification runtime exposed publicly', m => {
    m.runtimeReadinessContract.publicRuntimeIds.push('black-oracle-paper-vnext-s1r2');
  }],
  ['readiness granted execution authority', m => { m.runtimeReadinessContract.authority = 'EXECUTION'; }],
  ['deployment falsely claimed', m => { m.runtimeReadinessContract.sourceStatus = 'DEPLOYED'; }],
]) {
  test(`rejects ${name}`, () => {
    const manifest = fixture();
    change(manifest);
    assert.throws(() => validateB0Baseline(manifest));
  });
}
