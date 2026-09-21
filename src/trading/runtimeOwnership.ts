export const BOT_RUNTIME_OWNERSHIP_SCHEMA = 'bot.runtime-ownership.v1' as const;

export type BotAuthorityCeiling = 'PAPER' | 'LIVE_SHADOW' | 'LIVE_CANARY_READINESS';

export interface BotRuntimeOwnershipContract {
  schema: typeof BOT_RUNTIME_OWNERSHIP_SCHEMA;
  product: 'BLACK_ORACLE_BOT';
  runtimeOwner: 'BOT';
  databaseOwner: 'BOT';
  borDatabaseAccess: false;
  legacyPaperAccess: 'READ_ONLY_MIGRATION_EVIDENCE';
  brokerSecretsSurface: 'SERVER_ONLY';
  agentBrokerSecretAccess: false;
  frontendBrokerSecretAccess: false;
  deterministicRiskRequired: true;
  unrestrictedLiveEnabled: false;
  authorityCeiling: BotAuthorityCeiling;
}

export const BOT_RUNTIME_OWNERSHIP: BotRuntimeOwnershipContract = Object.freeze({
  schema: BOT_RUNTIME_OWNERSHIP_SCHEMA,
  product: 'BLACK_ORACLE_BOT',
  runtimeOwner: 'BOT',
  databaseOwner: 'BOT',
  borDatabaseAccess: false,
  legacyPaperAccess: 'READ_ONLY_MIGRATION_EVIDENCE',
  brokerSecretsSurface: 'SERVER_ONLY',
  agentBrokerSecretAccess: false,
  frontendBrokerSecretAccess: false,
  deterministicRiskRequired: true,
  unrestrictedLiveEnabled: false,
  authorityCeiling: 'LIVE_CANARY_READINESS',
});

export function assertBotRuntimeOwnership(
  candidate: BotRuntimeOwnershipContract,
): BotRuntimeOwnershipContract {
  const safe =
    candidate.schema === BOT_RUNTIME_OWNERSHIP_SCHEMA &&
    candidate.product === 'BLACK_ORACLE_BOT' &&
    candidate.runtimeOwner === 'BOT' &&
    candidate.databaseOwner === 'BOT' &&
    candidate.borDatabaseAccess === false &&
    candidate.legacyPaperAccess === 'READ_ONLY_MIGRATION_EVIDENCE' &&
    candidate.brokerSecretsSurface === 'SERVER_ONLY' &&
    candidate.agentBrokerSecretAccess === false &&
    candidate.frontendBrokerSecretAccess === false &&
    candidate.deterministicRiskRequired === true &&
    candidate.unrestrictedLiveEnabled === false &&
    ['PAPER', 'LIVE_SHADOW', 'LIVE_CANARY_READINESS'].includes(candidate.authorityCeiling);

  if (!safe) {
    throw new Error('BOT_RUNTIME_OWNERSHIP_VIOLATION');
  }

  return Object.freeze({ ...candidate });
}
