import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateB0Baseline(manifest) {
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.program, 'B0_FROZEN_BASELINE');
  assert.match(manifest.baselineSha, /^[a-f0-9]{40}$/);
  assert.equal(manifest.constitution, 'BLACK_ORACLE_PRODUCT_CONSTITUTION_V2');
  assert.equal(manifest.masterPlan, 'BLACK_ORACLE_BETA_SPRINT_MASTER_PLAN_V2');
  assert.equal(manifest.b0Status, 'IN_PROGRESS');

  const p = manifest.policy;
  assert.equal(p.tradingMode, 'PAPER_ONLY');
  assert.equal(p.reportRequiredForOrder, false);
  assert.equal(p.reportCanAuthorizeExecution, false);
  assert.equal(p.reportEvidenceAuthority, 'RESEARCH_GRADE_ONLY');
  assert.equal(p.executionEvidenceRequiresRevalidation, true);
  assert.equal(p.deterministicRiskSovereign, true);
  assert.equal(p.historicalAuditMutation, 'FORBIDDEN');
  assert.deepEqual(p.performanceStreams, ['BACKTEST', 'FORWARD', 'PAPER']);
  assert.equal(p.missingPerformance, 'UNKNOWN');
  assert.deepEqual(p.plans, ['Core', 'Plus', 'Pro', 'Max', 'Enterprise']);
  assert.deepEqual(p.proCapacityMultipliers, [1, 2, 5, 20]);
  assert.equal(p.capacityChangesEntitlements, false);
  assert.deepEqual(p.workloadPresets, ['Balanced', 'Strategy', 'Research']);

  const requiredSafety = ['POSITIONS','RISK','STOPS','PROTECTION','DECISION_REPLAY','AUDIT_HISTORY','FRESHNESS_STATUS','CRITICAL_ALERTS'];
  assert.deepEqual(p.creditSafetyExemptSurfaces, requiredSafety);

  const serviceNames = manifest.railway.services.map((s) => s.name).sort();
  assert.deepEqual(serviceNames, [
    'black-oracle-web',
    'black-oracle-paper-vnext',
    'black-oracle-paper-s2-shadow',
    'black-oracle-paper-v9-multiasset'
  ].sort());

  for (const service of manifest.railway.services) {
    assert.match(service.deploymentSha, /^[a-f0-9]{40}$/);
    if (service.configuredSha !== null) assert.match(service.configuredSha, /^[a-f0-9]{40}$/);
    assert.equal(service.deploymentStatus, 'SUCCESS');
    assert.equal(service.runtimeHealth, 'UNKNOWN');
  }

  const vnext = manifest.railway.services.find((s) => s.name === 'black-oracle-paper-vnext');
  assert.ok(vnext);
  assert.notEqual(vnext.configuredSha, vnext.deploymentSha);

  assert.ok(manifest.schedulerMappings.some((s) => s.runtimeId === 'black-oracle-paper-vnext-s1r2' && s.enabled));
  assert.ok(manifest.checkpointObservations.some((s) => s.runtimeId === 'black-oracle-paper-native-shadow'));
  assert.ok(manifest.activeCronJobs.length >= 3);
  assert.ok(Array.isArray(manifest.blockers) && manifest.blockers.length > 0);

  return {
    contractValid: true,
    releaseReady: false,
    b0Status: manifest.b0Status,
    unresolved: manifest.blockers
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = JSON.parse(readFileSync(new URL('../ops/b0-baseline.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(validateB0Baseline(manifest), null, 2));
}
