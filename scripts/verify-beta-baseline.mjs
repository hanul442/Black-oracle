import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Offline contract validation only. This neither probes nor changes production.
export function validateBetaBaseline(manifest) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.targetVersion, '1.0.0-beta.1');
  assert.match(manifest.baselineSha, /^[a-f0-9]{40}$/);
  assert.deepEqual(manifest.policy, {
    tradingMode: 'PAPER_ONLY', reportRequiredForOrder: false,
    reportCanBypassRisk: false, legacyDataAccess: 'READ_ONLY',
    personalization: 'POLICY_AND_ALLOCATION',
    performanceStreams: ['BACKTEST', 'FORWARD', 'PAPER'], missingPerformance: 'UNKNOWN',
    plans: ['Core', 'Plus', 'Pro', 'Max', 'Enterprise'],
    proCapacityMultipliers: [1, 2, 5, 20], capacityChangesEntitlements: false,
    profiles: ['Balanced', 'Strategy', 'Research'], profileMinimumPlan: 'Pro',
  });
  assert.deepEqual(manifest.services.map(s => s.name).sort(), [
    'black-oracle-web', 'black-oracle-paper-v9-multiasset',
    'black-oracle-paper-s2-shadow', 'black-oracle-paper-vnext',
  ].sort());
  const unresolved = [];
  for (const service of manifest.services) {
    assert.match(service.deploymentSha, /^[a-f0-9]{40}$/);
    if (service.configuredSha !== null) assert.match(service.configuredSha, /^[a-f0-9]{40}$/);
    // This snapshot contains liveness observations, not authenticated readiness proof.
    assert.equal(service.healthSemantics, 'PROCESS_LIVENESS');
    assert.equal(service.runtimeHealth, 'UNKNOWN');
    assert.equal(service.runtimeOwnership, 'UNKNOWN');
    unresolved.push(`${service.name}: runtime readiness/ownership unverified`);
    if (service.configuredSha && service.configuredSha !== service.deploymentSha) {
      unresolved.push(`${service.name}: configured/deployed revision mismatch`);
    }
  }
  assert.equal(manifest.b0Status, 'IN_PROGRESS');
  assert.ok(Array.isArray(manifest.blockers) && manifest.blockers.length > 0);
  return { contractValid: true, releaseReady: false, unresolved };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = JSON.parse(readFileSync(new URL('../ops/beta-baseline.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(validateBetaBaseline(manifest), null, 2));
}
