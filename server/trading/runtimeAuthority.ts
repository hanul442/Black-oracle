import type { RuntimeCheckpointAuthority, RuntimePhysicalProducer } from './persistence';

type EnvLike = Record<string, string | undefined>;

const required = (env: EnvLike, name: string) => {
  const value = String(env[name] ?? '').trim();
  if (!value) throw new Error(`Scheduled Paper authority requires ${name}.`);
  return value;
};

const optional = (env: EnvLike, name: string) => {
  const value = String(env[name] ?? '').trim();
  return value || null;
};

export const readRailwayPhysicalProducer = (env: EnvLike = process.env): RuntimePhysicalProducer => ({
  provider: 'railway',
  serviceName: required(env, 'RAILWAY_SERVICE_NAME'),
  serviceId: required(env, 'RAILWAY_SERVICE_ID'),
  deploymentId: required(env, 'RAILWAY_DEPLOYMENT_ID'),
  gitCommitSha: optional(env, 'RAILWAY_GIT_COMMIT_SHA'),
  replicaId: optional(env, 'RAILWAY_REPLICA_ID'),
  publicDomain: optional(env, 'RAILWAY_PUBLIC_DOMAIN'),
});

export const buildScheduledRuntimeAuthority = (
  configuredRuntimeId: string,
  delegatedRuntimeId: string,
  authorizedWriterService: string,
  cycleId: string,
  env: EnvLike = process.env,
): RuntimeCheckpointAuthority => {
  const runtimeId = configuredRuntimeId.trim();
  const delegated = delegatedRuntimeId.trim();
  const authorizedService = authorizedWriterService.trim();

  if (!runtimeId) throw new Error('Configured runtime id is missing.');
  if (!delegated) throw new Error('Delegated runtime id is missing.');
  if (delegated !== runtimeId) {
    throw new Error(`Delegated runtime ${delegated} does not match configured runtime ${runtimeId}.`);
  }
  if (!authorizedService) throw new Error('Authorized Railway writer service is missing.');
  if (!cycleId.trim()) throw new Error('Cycle id is missing.');

  const producer = readRailwayPhysicalProducer(env);
  if (producer.serviceName !== authorizedService) {
    throw new Error(
      `Railway writer ${producer.serviceName} is not authorized for runtime ${runtimeId}; expected ${authorizedService}.`,
    );
  }

  const leaseOwner = [
    'scheduled-worker',
    producer.serviceName,
    producer.deploymentId,
    cycleId,
  ].join(':');

  return {
    schemaVersion: 1,
    cycleId,
    delegatedRuntimeId: delegated,
    leaseOwner,
    producer,
  };
};
