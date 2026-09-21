import assert from 'node:assert/strict';
import test from 'node:test';
import type { StrategyValidationBinding } from './strategyValidationBinding';
import { routeChampionChallenger } from './championChallengerRouter';
import { arbitrateGovernance } from './governanceArbiter';

function binding(id: string): StrategyValidationBinding {
  return { schema: 'bot.strategy-validation-binding.v1', strategyId: id, strategyRevision: 'rev-1', experimentId: `exp-${id}`, validationStatus: 'PASS', validationEligible: true, stageResultFingerprints: { BACKTEST: 'sha256:a', OOS: 'sha256:b', WALK_FORWARD: 'sha256:c', MONTE_CARLO: 'sha256:d', EXECUTION_COST_STRESS: 'sha256:e' }, promotionAuthority: false, executionAuthority: false, capitalAuthority: false };
}
function router(score = 2) { return routeChampionChallenger({ champion: { role: 'CHAMPION', binding: binding('champ'), comparisonScore: 1, observedAt: '2026-09-21T08:00:00Z', maxAgeMs: 60_000, regimeFit: true }, challenger: { role: 'CHALLENGER', binding: binding('challenger'), comparisonScore: score, observedAt: '2026-09-21T08:00:00Z', maxAgeMs: 60_000, regimeFit: true }, evaluatedAt: '2026-09-21T08:00:30Z' }); }
function finding(verdict: 'APPROVE' | 'REJECT' | 'CLEAR' | 'VETO') { return { sourceId: `source-${verdict}`, strategyId: 'challenger', strategyRevision: 'rev-1', observedAt: '2026-09-21T08:00:35Z', maxAgeMs: 60_000, verdict, evidenceFingerprints: [`sha256:${verdict.toLowerCase()}`] }; }
function input() { return { routerDecision: router(), council: finding('APPROVE'), redTeam: finding('CLEAR'), evaluatedAt: '2026-09-21T08:00:40Z' }; }

test('approves only fresh matching Council approval and Red Team clear without authority', () => { const out = arbitrateGovernance(input()); assert.equal(out.action, 'APPROVE'); assert.equal(out.strategyId, 'challenger'); assert.equal(out.executionAuthority, false); assert.equal(out.riskBypassAuthority, false); assert.equal(out.liveAuthority, false); assert.equal(out.governanceEvidence.length, 2); });
test('router NO_TRADE is terminal', () => { const x = input(); x.routerDecision = router(1); const out = arbitrateGovernance(x); assert.equal(out.action, 'NO_TRADE'); assert.equal(out.reason, 'ROUTER_NO_TRADE'); });
test('missing governance evidence fails closed', () => { const x = input(); x.council = null as never; assert.equal(arbitrateGovernance(x).reason, 'GOVERNANCE_EVIDENCE_MISSING'); });
test('stale and future evidence fail closed', () => { const x = input(); x.redTeam.observedAt = '2026-09-21T07:00:00Z'; assert.equal(arbitrateGovernance(x).reason, 'GOVERNANCE_EVIDENCE_STALE'); const y = input(); y.council.observedAt = '2026-09-21T09:00:00Z'; assert.equal(arbitrateGovernance(y).reason, 'GOVERNANCE_EVIDENCE_STALE'); });
test('identity mismatch fails closed', () => { const x = input(); x.council.strategyId = 'other'; assert.equal(arbitrateGovernance(x).reason, 'GOVERNANCE_IDENTITY_MISMATCH'); });
test('Red Team veto and Council rejection fail closed', () => { const x = input(); x.redTeam = finding('VETO'); assert.equal(arbitrateGovernance(x).reason, 'RED_TEAM_VETO'); const y = input(); y.council = finding('REJECT'); assert.equal(arbitrateGovernance(y).reason, 'COUNCIL_REJECTED'); });
test('malformed evidence and authority escalation are rejected', () => { const x = input(); x.council.sourceId = ' '; assert.throws(() => arbitrateGovernance(x), /sourceId/); const y = input(); y.redTeam.evidenceFingerprints = []; assert.throws(() => arbitrateGovernance(y), /evidenceFingerprints/); assert.throws(() => arbitrateGovernance({ ...input(), executionAuthority: true }), /cannot grant authority/); });
