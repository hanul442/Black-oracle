import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = JSON.parse(await readFile(new URL('../ops/b0-deployment-blocker-disposition.json', import.meta.url), 'utf8'));

const valid = (d) => {
  const services = new Map(d.services.map((service) => [service.service, service]));
  const vnext = services.get('black-oracle-paper-vnext');
  const s2 = services.get('black-oracle-paper-s2-shadow');
  return d.status === 'CARRIED_FORWARD_BLOCKED'
    && d.cutoverAuthorized === false
    && d.genericRedeployAuthorized === false
    && d.productionMutation === false
    && d.carryForward.blocksB0Exit === true
    && d.carryForward.blocksB1ProductionCutover === true
    && vnext?.configuredSource.commitSha !== vnext?.latestDeployment.commitSha
    && vnext?.runtimeHealth === 'NOT_READY'
    && s2?.configuredSource.commitSha === null
    && s2?.runtimeHealth === 'DEGRADED'
    && d.services.every((service) => /^DO_NOT_REDEPLOY/.test(service.disposition))
    && d.services.every((service) => service.resolutionGate.includes('ROLLBACK_ARTIFACT_PROVEN'));
};

test('accepts explicit fail-closed carry-forward', () => assert.equal(valid(source), true));

for (const [name, mutate] of [
  ['cutover authorization', (d) => { d.cutoverAuthorized = true; }],
  ['generic redeploy authorization', (d) => { d.genericRedeployAuthorized = true; }],
  ['production mutation', (d) => { d.productionMutation = true; }],
  ['false B0 unblock', (d) => { d.carryForward.blocksB0Exit = false; }],
  ['false B1 cutover', (d) => { d.carryForward.blocksB1ProductionCutover = false; }],
  ['hidden vNext mismatch', (d) => { const v = d.services[0]; v.latestDeployment.commitSha = v.configuredSource.commitSha; }],
  ['invented vNext readiness', (d) => { d.services[0].runtimeHealth = 'READY'; }],
  ['invented S2 pin', (d) => { d.services[1].configuredSource.commitSha = 'a'.repeat(40); }],
  ['invented S2 readiness', (d) => { d.services[1].runtimeHealth = 'READY'; }],
  ['redeploy allowed', (d) => { d.services[1].disposition = 'REDEPLOY'; }],
  ['rollback proof omitted', (d) => { d.services[0].resolutionGate = d.services[0].resolutionGate.filter((gate) => gate !== 'ROLLBACK_ARTIFACT_PROVEN'); }]
]) {
  test(`rejects ${name}`, () => {
    const candidate = structuredClone(source);
    mutate(candidate);
    assert.equal(valid(candidate), false);
  });
}
