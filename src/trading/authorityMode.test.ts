import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAlphaAuthoritySafe,
  assertBrokerOrderSubmissionAllowed,
  assertPaperExecutionAllowed,
  buildBotAuthorityProfile,
  parseAuthorityMode,
  readBotAuthorityProfile,
} from './authorityMode';

test('authority defaults to PAPER to preserve the existing paper runtime', () => {
  const profile = readBotAuthorityProfile({});
  assert.equal(profile.mode, 'PAPER');
  assert.equal(profile.capabilities.canPaperExecute, true);
  assert.equal(profile.capabilities.canSubmitBrokerOrders, false);
  assert.equal(profile.capabilities.usesLiveCapital, false);
});

test('all canonical BOT authority modes parse explicitly', () => {
  for (const mode of ['SHADOW', 'PAPER', 'LIVE_SHADOW', 'LIVE_CANARY', 'LIVE'] as const) {
    assert.equal(parseAuthorityMode(mode.toLowerCase()), mode);
  }
});

test('legacy and unknown live modes are rejected instead of silently mapped', () => {
  assert.throws(() => parseAuthorityMode('AUTO_LIVE'), /Unsupported BOT_AUTHORITY_MODE/);
  assert.throws(() => parseAuthorityMode('APPROVAL_LIVE'), /Unsupported BOT_AUTHORITY_MODE/);
  assert.throws(() => parseAuthorityMode('SOMETHING_ELSE'), /Unsupported BOT_AUTHORITY_MODE/);
});

test('unrestricted LIVE authority fails closed for Alpha', () => {
  const profile = buildBotAuthorityProfile('LIVE');
  assert.equal(profile.hardBlocked, true);
  assert.equal(profile.capabilities.canSubmitBrokerOrders, false);
  assert.throws(() => assertAlphaAuthoritySafe(profile), /blocked for Alpha v0\.1/);
});

test('LIVE_CANARY exists as readiness-only authority with no live-capital submission', () => {
  const profile = assertAlphaAuthoritySafe(buildBotAuthorityProfile('LIVE_CANARY'));
  assert.equal(profile.requiresQualification, true);
  assert.equal(profile.capabilities.canReadBroker, true);
  assert.equal(profile.capabilities.canBrokerDryRun, true);
  assert.equal(profile.capabilities.canSubmitBrokerOrders, false);
  assert.equal(profile.capabilities.usesLiveCapital, false);
  assert.doesNotThrow(() => assertPaperExecutionAllowed(profile));
});

test('SHADOW cannot mutate the paper portfolio', () => {
  const profile = buildBotAuthorityProfile('SHADOW');
  assert.equal(profile.capabilities.canPaperExecute, false);
  assert.throws(() => assertPaperExecutionAllowed(profile), /does not allow Paper execution/);
});

test('broker order submission is fail-closed in every Alpha-safe mode', () => {
  for (const mode of ['SHADOW', 'PAPER', 'LIVE_SHADOW', 'LIVE_CANARY'] as const) {
    const profile = assertAlphaAuthoritySafe(buildBotAuthorityProfile(mode));
    assert.throws(
      () => assertBrokerOrderSubmissionAllowed(profile),
      /Broker order submission is disabled in BOT Alpha v0\.1/,
    );
  }
});
