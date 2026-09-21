import assert from 'node:assert/strict';
import test from 'node:test';
import type { StrategyValidationBinding } from './strategyValidationBinding';
import { routeChampionChallenger } from './championChallengerRouter';

function binding(id: string, eligible = true): StrategyValidationBinding {
  return { schema: 'bot.strategy-validation-binding.v1', strategyId: id, strategyRevision: 'rev-1', experimentId: `exp-${id}`, validationStatus: eligible ? 'PASS' : 'BLOCKED', validationEligible: eligible, stageResultFingerprints: { BACKTEST: 'sha256:a', OOS: 'sha256:b', WALK_FORWARD: 'sha256:c', MONTE_CARLO: 'sha256:d', EXECUTION_COST_STRESS: 'sha256:e' }, promotionAuthority: false, executionAuthority: false, capitalAuthority: false };
}
function input() { return { champion: { role: 'CHAMPION' as const, binding: binding('champ'), comparisonScore: 1, observedAt: '2026-09-21T08:00:00Z', maxAgeMs: 60_000, regimeFit: true }, challenger: { role: 'CHALLENGER' as const, binding: binding('challenger'), comparisonScore: 2, observedAt: '2026-09-21T08:00:00Z', maxAgeMs: 60_000, regimeFit: true }, evaluatedAt: '2026-09-21T08:00:30Z' }; }

test('selects exactly higher-scored eligible candidate without authority', () => { const out = routeChampionChallenger(input()); assert.equal(out.action, 'SELECT'); assert.equal(out.selectedRole, 'CHALLENGER'); assert.equal(out.executionAuthority, false); assert.equal(out.riskBypassAuthority, false); assert.equal(out.liveAuthority, false); });
test('tie resolves NO_TRADE', () => { const x = input(); x.challenger.comparisonScore = 1; assert.equal(routeChampionChallenger(x).reason, 'SCORE_TIE'); });
test('validation-ineligible resolves NO_TRADE', () => { const x = input(); x.challenger.binding = binding('challenger', false); assert.equal(routeChampionChallenger(x).reason, 'VALIDATION_INELIGIBLE'); });
test('stale and future observations resolve NO_TRADE', () => { const x = input(); x.challenger.observedAt = '2026-09-21T07:00:00Z'; assert.equal(routeChampionChallenger(x).reason, 'STALE_OBSERVATION'); const y = input(); y.challenger.observedAt = '2026-09-21T09:00:00Z'; assert.equal(routeChampionChallenger(y).reason, 'STALE_OBSERVATION'); });
test('missing or incompatible regime fit resolves NO_TRADE', () => { const x = input(); x.challenger.regimeFit = null; assert.equal(routeChampionChallenger(x).reason, 'REGIME_FIT_MISSING'); const y = input(); y.challenger.regimeFit = false; assert.equal(routeChampionChallenger(y).reason, 'REGIME_INCOMPATIBLE'); });
test('rejects non-finite scores, duplicate identity and authority escalation', () => { const x = input(); x.challenger.comparisonScore = Number.NaN; assert.throws(() => routeChampionChallenger(x), /finite/); const y = input(); y.challenger.binding = binding('champ'); assert.throws(() => routeChampionChallenger(y), /distinct/); assert.throws(() => routeChampionChallenger({ ...input(), executionAuthority: true }), /cannot grant authority/); });
