export type LedgerHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
export type ProducerMode = 'REQUIRED' | 'COUPLED' | 'CONDITIONAL';

export type LedgerProducerHealth = {
  source: string;
  mode: ProducerMode;
  lastSeenAt: number | null;
  ageMs: number | null;
  status: 'HEALTHY' | 'STALE' | 'IDLE' | 'NEVER_SEEN';
  warnAfterMs: number | null;
  criticalAfterMs: number | null;
  reason: string;
};

export type SchedulerHealth = {
  enabled: boolean | null;
  lastInvokedAt: number | null;
  lastHttpStatus: number | null;
  lastOk: boolean | null;
  lastError: string | null;
  targetBaseUrl: string | null;
  ageMs: number | null;
  controlPlaneDrift: boolean;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';
  reason: string;
};

export type CanonicalLedgerHealth = {
  status: LedgerHealthStatus;
  checkedAt: number;
  runtimeId: string;
  scheduler: SchedulerHealth;
  producers: LedgerProducerHealth[];
  reasons: string[];
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const producerPolicies: Array<{
  source: string;
  mode: ProducerMode;
  warnAfterMs: number | null;
  criticalAfterMs: number | null;
}> = [
  { source: 'paper_runtime', mode: 'REQUIRED', warnAfterMs: 35 * MINUTE, criticalAfterMs: 60 * MINUTE },
  { source: 'deterministic_council', mode: 'COUPLED', warnAfterMs: 35 * MINUTE, criticalAfterMs: 60 * MINUTE },
  { source: 'strategy_factory', mode: 'REQUIRED', warnAfterMs: 36 * HOUR, criticalAfterMs: 60 * HOUR },
  { source: 'risk_gate', mode: 'COUPLED', warnAfterMs: 60 * MINUTE, criticalAfterMs: 3 * HOUR },
  { source: 'nars_bridge', mode: 'CONDITIONAL', warnAfterMs: null, criticalAfterMs: null },
  { source: 'nars_impact_analysis', mode: 'CONDITIONAL', warnAfterMs: null, criticalAfterMs: null },
  { source: 'ai_council', mode: 'CONDITIONAL', warnAfterMs: null, criticalAfterMs: null },
  { source: 'strategy_hypothesis_researcher', mode: 'CONDITIONAL', warnAfterMs: null, criticalAfterMs: null },
];

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key ? {
    base,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  } : null;
};

const parseTimestamp = (value: unknown): number | null => {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const loadLatestSource = async (source: string): Promise<number | null> => {
  const db = dbConfig();
  if (!db) return null;
  const url = new URL(`${db.base}/rest/v1/black_oracle_events`);
  url.searchParams.set('source', `eq.${source}`);
  url.searchParams.set('select', 'recorded_at');
  url.searchParams.set('order', 'recorded_at.desc');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: db.headers, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Ledger producer health read failed for ${source} (${response.status}).`);
  const rows = await response.json() as any[];
  return parseTimestamp(rows[0]?.recorded_at);
};

const loadScheduler = async (runtimeId: string) => {
  const db = dbConfig();
  if (!db) return null;
  const url = new URL(`${db.base}/rest/v1/black_oracle_trading_scheduler_config`);
  url.searchParams.set('runtime_id', `eq.${runtimeId}`);
  url.searchParams.set('select', 'enabled,target_base_url,last_invoked_at,last_http_status,last_ok,last_error,updated_at');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: db.headers, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Trading scheduler health read failed (${response.status}).`);
  const rows = await response.json() as any[];
  return rows[0] ?? null;
};

export const classifyProducerHealth = (
  policy: typeof producerPolicies[number],
  lastSeenAt: number | null,
  now = Date.now(),
): LedgerProducerHealth => {
  const ageMs = lastSeenAt == null ? null : Math.max(0, now - lastSeenAt);
  if (policy.mode === 'CONDITIONAL') {
    return {
      ...policy,
      lastSeenAt,
      ageMs,
      status: lastSeenAt == null ? 'NEVER_SEEN' : 'IDLE',
      reason: lastSeenAt == null
        ? 'Conditional producer has not emitted a canonical event since cutover; silence alone is not an outage.'
        : 'Conditional producer is event-driven; last-seen is informational and does not degrade ledger health.',
    };
  }
  if (lastSeenAt == null) {
    return {
      ...policy,
      lastSeenAt,
      ageMs,
      status: 'NEVER_SEEN',
      reason: 'Required/coupled producer has not emitted a canonical event since cutover.',
    };
  }
  if (policy.criticalAfterMs != null && ageMs! > policy.criticalAfterMs) {
    return {
      ...policy,
      lastSeenAt,
      ageMs,
      status: 'STALE',
      reason: `Producer has been silent longer than the critical threshold (${Math.round(policy.criticalAfterMs / MINUTE)}m).`,
    };
  }
  if (policy.warnAfterMs != null && ageMs! > policy.warnAfterMs) {
    return {
      ...policy,
      lastSeenAt,
      ageMs,
      status: 'STALE',
      reason: `Producer has been silent longer than the warning threshold (${Math.round(policy.warnAfterMs / MINUTE)}m).`,
    };
  }
  return {
    ...policy,
    lastSeenAt,
    ageMs,
    status: 'HEALTHY',
    reason: 'Producer emitted within its expected cadence window.',
  };
};

const schedulerControlPlaneDrift = (enabled: boolean | null, lastOk: boolean | null, lastError: string | null) =>
  enabled === true
  && lastOk === true
  && Boolean(lastError && /(CONTROLLED_SINGLE_CYCLE_COMPLETE|intentionally\s+disabled|recurring[^.]{0,80}disabled)/i.test(lastError));

export const classifySchedulerHealth = (schedulerRow: any, now = Date.now()): SchedulerHealth => {
  if (!schedulerRow) {
    return {
      enabled: null,
      lastInvokedAt: null,
      lastHttpStatus: null,
      lastOk: null,
      lastError: null,
      targetBaseUrl: null,
      ageMs: null,
      controlPlaneDrift: false,
      status: 'CRITICAL',
      reason: 'Scheduler configuration row is missing.',
    };
  }

  const enabled = schedulerRow.enabled == null ? null : Boolean(schedulerRow.enabled);
  const lastInvokedAt = parseTimestamp(schedulerRow.last_invoked_at);
  const lastHttpStatus = schedulerRow.last_http_status == null ? null : Number(schedulerRow.last_http_status);
  const lastOk = schedulerRow.last_ok == null ? null : Boolean(schedulerRow.last_ok);
  const lastError = schedulerRow.last_error == null || String(schedulerRow.last_error).trim() === ''
    ? null
    : String(schedulerRow.last_error).slice(0, 500);
  const targetBaseUrl = schedulerRow.target_base_url == null ? null : String(schedulerRow.target_base_url);
  const ageMs = lastInvokedAt == null ? null : Math.max(0, now - lastInvokedAt);
  const controlPlaneDrift = schedulerControlPlaneDrift(enabled, lastOk, lastError);

  let status: SchedulerHealth['status'] = 'HEALTHY';
  let reason = 'Railway Paper scheduler is enabled, recent, and last downstream invocation was accepted.';
  if (enabled !== true) {
    status = 'CRITICAL';
    reason = 'Canonical Paper scheduler is disabled.';
  } else if (lastOk === false) {
    status = 'CRITICAL';
    reason = `Last scheduler invocation failed${lastError ? `: ${lastError.slice(0, 240)}` : '.'}`;
  } else if (ageMs == null || ageMs > 60 * MINUTE) {
    status = 'CRITICAL';
    reason = 'No successful scheduler heartbeat has been recorded within 60 minutes.';
  } else if (ageMs > 35 * MINUTE) {
    status = 'DEGRADED';
    reason = 'Scheduler heartbeat is older than the expected 15-minute cadence window.';
  } else if (controlPlaneDrift) {
    status = 'DEGRADED';
    reason = 'Scheduler control-plane drift detected: source-of-truth says enabled while its preserved control marker says recurring execution is intentionally disabled.';
  }

  return {
    enabled,
    lastInvokedAt,
    lastHttpStatus,
    lastOk,
    lastError,
    targetBaseUrl,
    ageMs,
    controlPlaneDrift,
    status,
    reason,
  };
};

export const readCanonicalLedgerHealth = async (runtimeId = 'black-oracle-paper', now = Date.now()): Promise<CanonicalLedgerHealth> => {
  const db = dbConfig();
  if (!db) {
    return {
      status: 'CRITICAL',
      checkedAt: now,
      runtimeId,
      scheduler: {
        enabled: null,
        lastInvokedAt: null,
        lastHttpStatus: null,
        lastOk: null,
        lastError: null,
        targetBaseUrl: null,
        ageMs: null,
        controlPlaneDrift: false,
        status: 'UNKNOWN',
        reason: 'Supabase credentials are unavailable to audit canonical ledger health.',
      },
      producers: producerPolicies.map((policy) => classifyProducerHealth(policy, null, now)),
      reasons: ['Canonical ledger health cannot read its server-side source of truth.'],
    };
  }

  const [schedulerRow, ...lastSeen] = await Promise.all([
    loadScheduler(runtimeId),
    ...producerPolicies.map((policy) => loadLatestSource(policy.source)),
  ]);
  const producers = producerPolicies.map((policy, index) => classifyProducerHealth(policy, lastSeen[index] ?? null, now));
  const scheduler = classifySchedulerHealth(schedulerRow, now);

  const reasons: string[] = [];
  if (scheduler.status !== 'HEALTHY') reasons.push(scheduler.reason);
  for (const producer of producers) {
    if (producer.mode === 'CONDITIONAL') continue;
    if (producer.status === 'NEVER_SEEN') reasons.push(`${producer.source}: never seen since cutover.`);
    else if (producer.status === 'STALE') reasons.push(`${producer.source}: ${producer.reason}`);
  }

  const criticalProducer = producers.some((producer) =>
    producer.mode !== 'CONDITIONAL'
    && (producer.status === 'NEVER_SEEN'
      || (producer.status === 'STALE' && producer.criticalAfterMs != null && producer.ageMs != null && producer.ageMs > producer.criticalAfterMs)),
  );
  const degradedProducer = producers.some((producer) => producer.mode !== 'CONDITIONAL' && producer.status === 'STALE');
  const status: LedgerHealthStatus = scheduler.status === 'CRITICAL' || criticalProducer
    ? 'CRITICAL'
    : scheduler.status === 'DEGRADED' || degradedProducer
      ? 'DEGRADED'
      : 'HEALTHY';

  return {
    status,
    checkedAt: now,
    runtimeId,
    scheduler,
    producers,
    reasons,
  };
};
