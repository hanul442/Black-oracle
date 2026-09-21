import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertBotRuntimeOwnership,
  BOT_RUNTIME_OWNERSHIP,
  type BotRuntimeOwnershipContract,
} from './runtimeOwnership.js';

test('canonical BOT runtime ownership contract is accepted', () => {
  const result = assertBotRuntimeOwnership(BOT_RUNTIME_OWNERSHIP);
  assert.equal(result.databaseOwner, 'BOT');
  assert.equal(result.legacyPaperAccess, 'READ_ONLY_MIGRATION_EVIDENCE');
  assert.equal(result.unrestrictedLiveEnabled, false);
});

const unsafeCases: Array<[string, Partial<BotRuntimeOwnershipContract>]> = [
  ['BOR database access', { borDatabaseAccess: true as false }],
  ['agent broker secrets', { agentBrokerSecretAccess: true as false }],
  ['frontend broker secrets', { frontendBrokerSecretAccess: true as false }],
  ['risk bypass', { deterministicRiskRequired: false as true }],
  ['unrestricted live', { unrestrictedLiveEnabled: true as false }],
  ['mutable legacy PAPER', { legacyPaperAccess: 'READ_WRITE' as 'READ_ONLY_MIGRATION_EVIDENCE' }],
];

for (const [name, override] of unsafeCases) {
  test(`fails closed on ${name}`, () => {
    const candidate = { ...BOT_RUNTIME_OWNERSHIP, ...override } as BotRuntimeOwnershipContract;
    assert.throws(() => assertBotRuntimeOwnership(candidate), /BOT_RUNTIME_OWNERSHIP_VIOLATION/);
  });
}

test('returned ownership contract cannot be mutated', () => {
  const result = assertBotRuntimeOwnership({ ...BOT_RUNTIME_OWNERSHIP });
  assert.equal(Object.isFrozen(result), true);
});
