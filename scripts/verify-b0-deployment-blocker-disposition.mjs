import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const disposition = JSON.parse(await readFile(new URL('../ops/b0-deployment-blocker-disposition.json', import.meta.url), 'utf8'));

assert.equal(disposition.sprint, 'B0');
assert.equal(disposition.workPackage, 'B0.6');
assert.equal(disposition.status, 'CARRIED_FORWARD_BLOCKED');
assert.equal(disposition.cutoverAuthorized, false);
assert.equal(disposition.genericRedeployAuthorized, false);
assert.equal(disposition.productionMutation, false);
assert.equal(disposition.carryForward.blocksB0Exit, true);
assert.equal(disposition.carryForward.blocksB1ProductionCutover, true);
assert.equal(disposition.rollback.currentAction, 'NO_CHANGE');

const services = new Map(disposition.services.map((service) => [service.service, service]));
const vnext = services.get('black-oracle-paper-vnext');
const s2 = services.get('black-oracle-paper-s2-shadow');
assert.ok(vnext && s2);
assert.match(vnext.configuredSource.commitSha, /^[a-f0-9]{40}$/);
assert.match(vnext.latestDeployment.commitSha, /^[a-f0-9]{40}$/);
assert.notEqual(vnext.configuredSource.commitSha, vnext.latestDeployment.commitSha);
assert.equal(vnext.revisionMatch, false);
assert.equal(vnext.runtimeHealth, 'NOT_READY');
assert.equal(s2.configuredSource.branch, null);
assert.equal(s2.configuredSource.commitSha, null);
assert.equal(s2.latestDeployment.reason, 'redeploy');
assert.equal(s2.runtimeHealth, 'DEGRADED');

for (const service of disposition.services) {
  assert.match(service.disposition, /^DO_NOT_REDEPLOY/);
  for (const gate of ['EXACT_COMMIT_DEPLOY_CONTROL', 'DEPLOYMENT_SHA_EQUALS_REQUESTED_SHA', 'RUNTIME_REPORTED_REVISION_EQUALS_DEPLOYMENT_SHA', 'ROLLBACK_ARTIFACT_PROVEN']) {
    assert.ok(service.resolutionGate.includes(gate), `${service.service} missing gate ${gate}`);
  }
}

console.log(`B0.6 deployment blockers: ${disposition.services.length} services explicitly carried forward; cutover=false`);
