import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateBetaBaseline } from './verify-beta-baseline.mjs';

const fixture = () => JSON.parse(readFileSync(new URL('../ops/beta-baseline.json', import.meta.url), 'utf8'));
test('baseline contract passes without claiming release readiness', () => {
  const result = validateBetaBaseline(fixture());
  assert.equal(result.contractValid, true);
  assert.equal(result.releaseReady, false);
  assert.ok(result.unresolved.some(s => s.includes('revision mismatch')));
});
for (const [name, change] of [
  ['live trading', m => { m.policy.tradingMode = 'LIVE'; }],
  ['Report dependency', m => { m.policy.reportRequiredForOrder = true; }],
  ['Risk bypass', m => { m.policy.reportCanBypassRisk = true; }],
  ['legacy data writes', m => { m.policy.legacyDataAccess = 'WRITE'; }],
  ['capacity privilege escalation', m => { m.policy.capacityChangesEntitlements = true; }],
  ['fabricated zero performance', m => { m.policy.missingPerformance = 0; }],
  ['strategy cloning', m => { m.policy.personalization = 'CLONE'; }],
  ['false B0 completion', m => { m.b0Status = 'DONE'; }],
  ['liveness as readiness', m => { m.services[0].runtimeHealth = 'HEALTHY'; }],
  ['invented ownership', m => { m.services[0].runtimeOwnership = 'VERIFIED'; }],
  ['missing service', m => { m.services.pop(); }],
  ['malformed revision', m => { m.services[0].deploymentSha = 'main'; }],
]) {
  test(`rejects ${name}`, () => {
    const manifest = fixture();
    change(manifest);
    assert.throws(() => validateBetaBaseline(manifest));
  });
}
