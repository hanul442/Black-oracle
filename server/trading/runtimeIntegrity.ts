export type RuntimeIntegrityStatus = 'OK' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

export type RuntimeIntegritySubsystemId =
  | 'DEPLOYMENT'
  | 'GATEWAY'
  | 'RUNTIME'
  | 'PERSISTENCE'
  | 'SCHEDULER'
  | 'LEDGER'
  | 'MARKET_DATA'
  | 'NARS'
  | 'AI_COUNCIL'
  | 'QUALIFICATION';

export type RuntimeIntegritySubsystem = {
  id: RuntimeIntegritySubsystemId;
  label: string;
  status: RuntimeIntegrityStatus;
  authoritative: boolean;
  source: string;
  reason: string;
  observedAt: number | null;
  details?: Record<string, unknown>;
};

export type RuntimeIntegrityReadModel = {
  schemaVersion: 1;
  checkedAt: number;
  status: Exclude<RuntimeIntegrityStatus, 'UNKNOWN'>;
  complete: boolean;
  executionAuthority: false;
  qualificationAuthority: false;
  subsystems: RuntimeIntegritySubsystem[];
  visibilityGaps: RuntimeIntegritySubsystemId[];
  criticalSubsystems: RuntimeIntegritySubsystemId[];
  degradedSubsystems: RuntimeIntegritySubsystemId[];
  summary: string;
};

type RuntimeHealthLike = {
  status?: string;
  now?: number;
  persistence?: {
    configured?: boolean;
    lastError?: string | null;
    fault?: boolean;
    profile?: {
      qualificationMode?: boolean;
      compatibility?: {
        status?: string;
        compatible?: boolean;
        reasons?: string[];
      } | null;
    };
  };
  loop?: {
    running?: boolean;
    cycleCount?: number;
    intervalMs?: number;
    lastCycleFinishedAt?: number | null;
    lastCycleErrors?: number;
    stale?: boolean;
  };
};

type LedgerHealthLike = {
  status?: string;
  checkedAt?: number;
  scheduler?: {
    status?: string;
    enabled?: boolean | null;
    lastInvokedAt?: number | null;
    lastHttpStatus?: number | null;
    lastOk?: boolean | null;
    ageMs?: number | null;
    reason?: string;
  };
  producers?: Array<{
    source?: string;
    lastSeenAt?: number | null;
    ageMs?: number | null;
    status?: string;
    reason?: string;
  }>;
  reasons?: string[];
};

type RuntimeProfileLike = {
  runtimeId?: string;
  qualificationId?: string | null;
  qualificationMode?: boolean;
  systemRevision?: string;
  strategyVersion?: string;
  riskConfigHash?: string;
};

export type RuntimeIntegrityInput = {
  runtimeHealth: RuntimeHealthLike;
  ledgerHealth: LedgerHealthLike | null;
  profile: RuntimeProfileLike;
  gatewayObserved: boolean;
  deploymentRevision?: string | null;
  probeErrors?: string[];
  now?: number;
};

const mapHealthStatus = (status: string | undefined): RuntimeIntegrityStatus => {
  switch (String(status ?? '').toUpperCase()) {
    case 'OK':
    case 'HEALTHY':
      return 'OK';
    case 'DEGRADED':
    case 'STALE':
      return 'DEGRADED';
    case 'CRITICAL':
    case 'ERROR':
    case 'BLOCKED':
    case 'DOWN':
      return 'CRITICAL';
    default:
      return 'UNKNOWN';
  }
};

const producer = (ledger: LedgerHealthLike | null, source: string) =>
  ledger?.producers?.find((item) => item.source === source) ?? null;

const statusReason = (status: RuntimeIntegrityStatus, ok: string, degraded: string, critical: string, unknown: string) =>
  status === 'OK' ? ok : status === 'DEGRADED' ? degraded : status === 'CRITICAL' ? critical : unknown;

export const buildRuntimeIntegrityReadModel = ({
  runtimeHealth,
  ledgerHealth,
  profile,
  gatewayObserved,
  deploymentRevision,
  probeErrors = [],
  now = Date.now(),
}: RuntimeIntegrityInput): RuntimeIntegrityReadModel => {
  const runtimeStatus = mapHealthStatus(runtimeHealth.status);
  const persistenceStatus: RuntimeIntegrityStatus = runtimeHealth.persistence?.fault === true
    || runtimeHealth.persistence?.configured === false
    || Boolean(runtimeHealth.persistence?.lastError)
    ? 'CRITICAL'
    : runtimeHealth.persistence?.configured === true
      ? 'OK'
      : 'UNKNOWN';
  const schedulerStatus = mapHealthStatus(ledgerHealth?.scheduler?.status);
  const ledgerStatus = mapHealthStatus(ledgerHealth?.status);
  const gatewayStatus: RuntimeIntegrityStatus = gatewayObserved ? 'OK' : 'UNKNOWN';
  const deploymentStatus: RuntimeIntegrityStatus = deploymentRevision ? 'OK' : 'UNKNOWN';

  const narsBridge = producer(ledgerHealth, 'nars_bridge');
  const narsImpact = producer(ledgerHealth, 'nars_impact_analysis');
  const aiCouncil = producer(ledgerHealth, 'ai_council');

  const qualificationMode = Boolean(profile.qualificationMode ?? runtimeHealth.persistence?.profile?.qualificationMode);
  const compatibility = runtimeHealth.persistence?.profile?.compatibility;
  let qualificationStatus: RuntimeIntegrityStatus = 'OK';
  let qualificationReason = 'This runtime is not an armed qualification cohort; no qualification authority is inferred.';
  if (qualificationMode) {
    if (compatibility?.status === 'MATCH' && compatibility.compatible === true) {
      qualificationStatus = 'OK';
      qualificationReason = 'Qualification profile and restored checkpoint identity match the pinned cohort.';
    } else if (compatibility?.status === 'BLOCKED' || compatibility?.compatible === false) {
      qualificationStatus = 'CRITICAL';
      qualificationReason = `Qualification checkpoint compatibility is blocked${compatibility?.reasons?.length ? `: ${compatibility.reasons.join(' ')}` : '.'}`;
    } else {
      qualificationStatus = 'DEGRADED';
      qualificationReason = 'Qualification is armed but checkpoint compatibility has not been positively established in this process.';
    }
  }

  const subsystems: RuntimeIntegritySubsystem[] = [
    {
      id: 'DEPLOYMENT',
      label: 'Deployment',
      status: deploymentStatus,
      authoritative: false,
      source: deploymentRevision ? 'RAILWAY_GIT_COMMIT_SHA/self-report' : 'external control-plane probe not wired',
      reason: deploymentRevision
        ? `Serving process reports deployment revision ${deploymentRevision}; Railway control-plane health must still be verified externally.`
        : 'No deployment revision is visible to this process; external deployment health is intentionally not guessed.',
      observedAt: deploymentRevision ? now : null,
      details: { revision: deploymentRevision ?? null },
    },
    {
      id: 'GATEWAY',
      label: 'Gateway',
      status: gatewayStatus,
      authoritative: gatewayObserved,
      source: 'authenticated Railway gateway traversal marker',
      reason: gatewayObserved
        ? 'This request traversed the Black Oracle gateway before reaching the trading runtime.'
        : 'Gateway traversal could not be proven for this request path.',
      observedAt: gatewayObserved ? now : null,
    },
    {
      id: 'RUNTIME',
      label: 'Runtime',
      status: runtimeStatus,
      authoritative: true,
      source: 'in-process trading runtime health',
      reason: statusReason(
        runtimeStatus,
        'Paper runtime loop and persistence checks are healthy.',
        'Paper runtime reports a degraded loop or persistence condition.',
        'Paper runtime reports a critical condition.',
        'Paper runtime health is unavailable.',
      ),
      observedAt: runtimeHealth.now ?? now,
      details: {
        running: runtimeHealth.loop?.running ?? null,
        cycleCount: runtimeHealth.loop?.cycleCount ?? null,
        lastCycleFinishedAt: runtimeHealth.loop?.lastCycleFinishedAt ?? null,
        lastCycleErrors: runtimeHealth.loop?.lastCycleErrors ?? null,
        stale: runtimeHealth.loop?.stale ?? null,
      },
    },
    {
      id: 'PERSISTENCE',
      label: 'Persistence',
      status: persistenceStatus,
      authoritative: true,
      source: 'runtime checkpoint store status',
      reason: persistenceStatus === 'OK'
        ? 'Checkpoint persistence is configured and has no reported fault.'
        : persistenceStatus === 'CRITICAL'
          ? `Checkpoint persistence is faulted${runtimeHealth.persistence?.lastError ? `: ${runtimeHealth.persistence.lastError}` : '.'}`
          : 'Checkpoint persistence configuration could not be established.',
      observedAt: runtimeHealth.now ?? now,
    },
    {
      id: 'SCHEDULER',
      label: 'Scheduler',
      status: schedulerStatus,
      authoritative: Boolean(ledgerHealth?.scheduler),
      source: 'Supabase scheduler source of truth',
      reason: ledgerHealth?.scheduler?.reason ?? 'Scheduler source-of-truth probe is unavailable.',
      observedAt: ledgerHealth?.scheduler?.lastInvokedAt ?? ledgerHealth?.checkedAt ?? null,
      details: {
        enabled: ledgerHealth?.scheduler?.enabled ?? null,
        lastHttpStatus: ledgerHealth?.scheduler?.lastHttpStatus ?? null,
        lastOk: ledgerHealth?.scheduler?.lastOk ?? null,
        ageMs: ledgerHealth?.scheduler?.ageMs ?? null,
      },
    },
    {
      id: 'LEDGER',
      label: 'Canonical Ledger',
      status: ledgerStatus,
      authoritative: Boolean(ledgerHealth),
      source: 'canonical event ledger producer audit',
      reason: ledgerHealth?.reasons?.length
        ? ledgerHealth.reasons.join(' ')
        : ledgerStatus === 'OK'
          ? 'Required canonical ledger producers are within their expected cadence windows.'
          : 'Canonical ledger health probe is unavailable.',
      observedAt: ledgerHealth?.checkedAt ?? null,
    },
    {
      id: 'MARKET_DATA',
      label: 'Market Data',
      status: 'UNKNOWN',
      authoritative: false,
      source: 'standalone freshness probe not yet wired',
      reason: 'Runtime cycle freshness is not equivalent to market-data freshness; 15m/1h/4h source ages remain an explicit observability gap.',
      observedAt: null,
      details: {
        loopLastCycleFinishedAt: runtimeHealth.loop?.lastCycleFinishedAt ?? null,
        loopStale: runtimeHealth.loop?.stale ?? null,
      },
    },
    {
      id: 'NARS',
      label: 'NARS Evidence',
      status: 'UNKNOWN',
      authoritative: false,
      source: 'canonical ledger activity only; source-health probe not yet wired',
      reason: narsBridge || narsImpact
        ? 'NARS-related canonical events are observable, but event activity alone cannot certify NARS ingestion/source health.'
        : 'No independent NARS source-health probe is connected to this read model.',
      observedAt: Math.max(narsBridge?.lastSeenAt ?? 0, narsImpact?.lastSeenAt ?? 0) || null,
      details: {
        bridgeLastSeenAt: narsBridge?.lastSeenAt ?? null,
        impactLastSeenAt: narsImpact?.lastSeenAt ?? null,
      },
    },
    {
      id: 'AI_COUNCIL',
      label: 'AI Council',
      status: 'UNKNOWN',
      authoritative: false,
      source: 'canonical ledger activity only; Council source-health probe not yet wired',
      reason: aiCouncil
        ? 'AI Council canonical activity is visible, but event activity does not prove model availability, budget headroom, or prospective value.'
        : 'No independent AI Council source-health probe is connected to this read model.',
      observedAt: aiCouncil?.lastSeenAt ?? null,
      details: {
        lastSeenAt: aiCouncil?.lastSeenAt ?? null,
        producerStatus: aiCouncil?.status ?? null,
      },
    },
    {
      id: 'QUALIFICATION',
      label: 'Qualification',
      status: qualificationStatus,
      authoritative: qualificationMode && compatibility?.status === 'MATCH',
      source: 'runtime profile + checkpoint compatibility',
      reason: qualificationReason,
      observedAt: runtimeHealth.now ?? now,
      details: {
        runtimeId: profile.runtimeId ?? null,
        qualificationId: profile.qualificationId ?? null,
        qualificationMode,
        compatibilityStatus: compatibility?.status ?? null,
        systemRevision: profile.systemRevision ?? null,
        strategyVersion: profile.strategyVersion ?? null,
        riskConfigHash: profile.riskConfigHash ?? null,
      },
    },
  ];

  if (probeErrors.length) {
    const ledger = subsystems.find((item) => item.id === 'LEDGER');
    if (ledger && ledger.status === 'UNKNOWN') {
      ledger.reason = `${ledger.reason} Probe errors: ${probeErrors.join(' | ')}`;
    }
  }

  const visibilityGaps = subsystems.filter((item) => item.status === 'UNKNOWN').map((item) => item.id);
  const criticalSubsystems = subsystems.filter((item) => item.status === 'CRITICAL').map((item) => item.id);
  const degradedSubsystems = subsystems.filter((item) => item.status === 'DEGRADED').map((item) => item.id);
  const status: RuntimeIntegrityReadModel['status'] = criticalSubsystems.length
    ? 'CRITICAL'
    : degradedSubsystems.length || visibilityGaps.length
      ? 'DEGRADED'
      : 'OK';

  return {
    schemaVersion: 1,
    checkedAt: now,
    status,
    complete: visibilityGaps.length === 0,
    executionAuthority: false,
    qualificationAuthority: false,
    subsystems,
    visibilityGaps,
    criticalSubsystems,
    degradedSubsystems,
    summary: criticalSubsystems.length
      ? `Critical subsystem(s): ${criticalSubsystems.join(', ')}.`
      : visibilityGaps.length
        ? `Runtime is observable but incomplete; unresolved probe(s): ${visibilityGaps.join(', ')}.`
        : degradedSubsystems.length
          ? `No critical subsystem, but degraded subsystem(s): ${degradedSubsystems.join(', ')}.`
          : 'All registered runtime-integrity probes are healthy.',
  };
};
