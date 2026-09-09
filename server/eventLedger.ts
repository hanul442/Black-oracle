export type CanonicalEventType =
  | 'SYSTEM'
  | 'EVIDENCE'
  | 'STRATEGY'
  | 'COUNCIL'
  | 'DECISION'
  | 'RISK'
  | 'ORDER'
  | 'TRADE'
  | 'OUTCOME'
  | 'EXPERIMENT'
  | 'AI';

export type CanonicalEventInput = {
  eventKey: string;
  occurredAt: number | string;
  runtimeId?: string | null;
  eventType: CanonicalEventType;
  eventName: string;
  market?: string | null;
  strategyId?: string | null;
  strategyVersion?: string | null;
  action?: string | null;
  summary: string;
  reason?: string | null;
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  authority?: string;
  executionAuthority?: boolean;
  source: string;
  trace?: Record<string, unknown> | null;
  links?: Record<string, unknown> | null;
};

export type CanonicalEventRow = {
  id: string;
  eventKey: string;
  occurredAt: number;
  recordedAt: number;
  runtimeId: string | null;
  eventType: CanonicalEventType;
  eventName: string;
  market: string | null;
  strategyId: string | null;
  strategyVersion: string | null;
  action: string | null;
  summary: string;
  reason: string | null;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  authority: string;
  executionAuthority: boolean;
  source: string;
  trace: Record<string, unknown>;
  links: Record<string, unknown>;
  schemaVersion: number;
};

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key
    ? {
        base,
        key,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    : null;
};

const asIso = (value: number | string) => {
  if (typeof value === 'number') return new Date(value).toISOString();
  const parsed = Date.parse(value);
  return new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString();
};

const safeText = (value: unknown, max = 2_000) => String(value ?? '').slice(0, max);

const toDbRow = (event: CanonicalEventInput) => ({
  event_key: safeText(event.eventKey, 500),
  occurred_at: asIso(event.occurredAt),
  runtime_id: event.runtimeId ? safeText(event.runtimeId, 200) : null,
  event_type: event.eventType,
  event_name: safeText(event.eventName, 120),
  market: event.market ? safeText(event.market, 120) : null,
  strategy_id: event.strategyId ? safeText(event.strategyId, 300) : null,
  strategy_version: event.strategyVersion ? safeText(event.strategyVersion, 200) : null,
  action: event.action ? safeText(event.action, 80) : null,
  summary: safeText(event.summary, 2_000),
  reason: event.reason ? safeText(event.reason, 4_000) : null,
  severity: event.severity ?? 'INFO',
  authority: safeText(event.authority ?? 'observed', 120),
  execution_authority: Boolean(event.executionAuthority),
  source: safeText(event.source, 160),
  trace: event.trace ?? {},
  links: event.links ?? {},
  schema_version: 1,
});

export const appendCanonicalEvents = async (events: CanonicalEventInput[]) => {
  if (!events.length) return { available: true, attempted: 0, persisted: true };
  const db = dbConfig();
  if (!db) return { available: false, attempted: events.length, persisted: false };

  const response = await fetch(`${db.base}/rest/v1/black_oracle_events?on_conflict=event_key`, {
    method: 'POST',
    headers: {
      ...db.headers,
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(events.map(toDbRow)),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Canonical event append failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  return { available: true, attempted: events.length, persisted: true };
};

const mapRow = (row: any): CanonicalEventRow => ({
  id: String(row.id ?? ''),
  eventKey: String(row.event_key ?? ''),
  occurredAt: row.occurred_at ? Date.parse(row.occurred_at) : 0,
  recordedAt: row.recorded_at ? Date.parse(row.recorded_at) : 0,
  runtimeId: row.runtime_id == null ? null : String(row.runtime_id),
  eventType: String(row.event_type ?? 'SYSTEM') as CanonicalEventType,
  eventName: String(row.event_name ?? ''),
  market: row.market == null ? null : String(row.market),
  strategyId: row.strategy_id == null ? null : String(row.strategy_id),
  strategyVersion: row.strategy_version == null ? null : String(row.strategy_version),
  action: row.action == null ? null : String(row.action),
  summary: String(row.summary ?? ''),
  reason: row.reason == null ? null : String(row.reason),
  severity: String(row.severity ?? 'INFO') as CanonicalEventRow['severity'],
  authority: String(row.authority ?? 'observed'),
  executionAuthority: Boolean(row.execution_authority),
  source: String(row.source ?? ''),
  trace: row.trace && typeof row.trace === 'object' ? row.trace : {},
  links: row.links && typeof row.links === 'object' ? row.links : {},
  schemaVersion: Number(row.schema_version ?? 1),
});

export const readCanonicalEvents = async (options: { limit?: number; type?: string | null; market?: string | null } = {}) => {
  const db = dbConfig();
  if (!db) return [] as CanonicalEventRow[];
  const limit = Math.max(1, Math.min(500, Math.trunc(Number(options.limit ?? 200))));
  const url = new URL(`${db.base}/rest/v1/black_oracle_events`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'occurred_at.desc,recorded_at.desc');
  url.searchParams.set('limit', String(limit));
  if (options.type) url.searchParams.set('event_type', `eq.${String(options.type).toUpperCase()}`);
  if (options.market) url.searchParams.set('market', `eq.${String(options.market).toUpperCase()}`);

  const response = await fetch(url, {
    headers: db.headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Canonical event read failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  return ((await response.json()) as any[]).map(mapRow);
};

const numberOrNow = (value: unknown, fallback = Date.now()) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const firstReason = (item: any) => String(item?.primaryReason ?? item?.reasons?.[0] ?? '').slice(0, 4_000) || null;

export const buildPaperCycleCanonicalEvents = (
  cycle: any,
  runtimeId: string,
  councilAi?: { reviews?: any[] } | null,
): CanonicalEventInput[] => {
  const markets = Array.isArray(cycle?.markets) ? cycle.markets : [];
  const cycleAt = numberOrNow(cycle?.finishedAt, markets.reduce((max: number, item: any) => Math.max(max, Number(item?.timestamp ?? 0)), 0) || Date.now());
  const cycleKey = `${runtimeId}:cycle:${cycleAt}`;
  const events: CanonicalEventInput[] = [{
    eventKey: `${cycleKey}:system`,
    occurredAt: cycleAt,
    runtimeId,
    eventType: 'SYSTEM',
    eventName: 'PAPER_CYCLE_COMPLETED',
    summary: `Paper cycle completed: scanned ${Number(cycle?.scanned ?? markets.length)}, entered ${Number(cycle?.entered ?? 0)}, exited ${Number(cycle?.exited ?? 0)}, held ${Number(cycle?.held ?? 0)}, no-trade ${Number(cycle?.noTrade ?? 0)}.`,
    reason: Array.isArray(cycle?.errors) && cycle.errors.length ? `${cycle.errors.length} cycle error(s) recorded.` : 'Cycle completed and checkpoint was persisted before advisory AI review.',
    severity: Array.isArray(cycle?.errors) && cycle.errors.length ? 'WARN' : 'INFO',
    authority: 'system_record',
    executionAuthority: false,
    source: 'paper_runtime',
    trace: {
      startedAt: cycle?.startedAt ?? null,
      finishedAt: cycle?.finishedAt ?? null,
      scanned: cycle?.scanned ?? markets.length,
      entered: cycle?.entered ?? 0,
      exited: cycle?.exited ?? 0,
      held: cycle?.held ?? 0,
      noTrade: cycle?.noTrade ?? 0,
      errors: Array.isArray(cycle?.errors) ? cycle.errors : [],
      evidenceOps: cycle?.evidenceOps ?? null,
    },
  }];

  for (const item of markets) {
    const market = String(item?.market ?? 'UNKNOWN');
    const timestamp = numberOrNow(item?.timestamp, cycleAt);
    const prefix = `${runtimeId}:${market}:${timestamp}`;
    const decision = String(item?.decision ?? item?.action ?? 'UNKNOWN');
    const strategy = item?.strategyDisposition == null ? null : String(item.strategyDisposition);
    const evidenceIds = Array.isArray(item?.evidenceIds) ? item.evidenceIds.map(String) : [];

    if (strategy) {
      events.push({
        eventKey: `${prefix}:strategy`,
        occurredAt: timestamp,
        runtimeId,
        eventType: 'STRATEGY',
        eventName: 'STRATEGY_ROUTED',
        market,
        strategyId: strategy,
        strategyVersion: item?.strategyVersion == null ? null : String(item.strategyVersion),
        action: item?.router?.route == null ? strategy : String(item.router.route),
        summary: `${market} routed to ${strategy}.`,
        reason: String(item?.router?.reasons?.[0] ?? firstReason(item) ?? 'Router recorded no primary rationale.'),
        authority: 'strategy_router',
        executionAuthority: false,
        source: 'paper_runtime',
        trace: { strategyDisposition: strategy, router: item?.router ?? null, regime: item?.regime ?? null, confidence: item?.confidence ?? null },
      });
    }

    if (evidenceIds.length || Number(item?.evidenceActiveCount ?? 0) > 0) {
      events.push({
        eventKey: `${prefix}:evidence`,
        occurredAt: timestamp,
        runtimeId,
        eventType: 'EVIDENCE',
        eventName: 'EVIDENCE_LINKED',
        market,
        action: decision,
        summary: `${market} decision context linked ${evidenceIds.length || Number(item?.evidenceActiveCount ?? 0)} Evidence item(s).`,
        reason: item?.forecast?.reasons?.[0] == null ? null : String(item.forecast.reasons[0]),
        authority: 'evidence_only',
        executionAuthority: false,
        source: 'paper_runtime',
        trace: {
          evidenceActiveCount: item?.evidenceActiveCount ?? 0,
          evidenceContradictionCount: item?.evidenceContradictionCount ?? 0,
          eventScore: item?.eventScore ?? null,
          forecast: item?.forecast ?? null,
        },
        links: { evidenceIds },
      });
    }

    if (item?.council) {
      events.push({
        eventKey: `${prefix}:council`,
        occurredAt: timestamp,
        runtimeId,
        eventType: 'COUNCIL',
        eventName: 'DETERMINISTIC_COUNCIL_REVIEWED',
        market,
        action: decision,
        summary: `${market} deterministic Council ${String(item.council.verdict ?? 'UNKNOWN')}: ${String(item.council.summary ?? '')}`.trim(),
        reason: String(item?.council?.members?.find?.((member: any) => member?.vote === 'REJECT')?.reasons?.[0] ?? item?.council?.members?.find?.((member: any) => member?.vote === 'CAUTION')?.reasons?.[0] ?? 'No material dissent recorded.'),
        authority: 'advisory_shadow',
        executionAuthority: false,
        source: 'deterministic_council',
        trace: item.council,
      });
    }

    if (String(item?.riskDisposition ?? 'NOT_EVALUATED') !== 'NOT_EVALUATED' || (Array.isArray(item?.riskReasons) && item.riskReasons.length)) {
      const risk = String(item?.riskDisposition ?? 'NOT_EVALUATED');
      events.push({
        eventKey: `${prefix}:risk`,
        occurredAt: timestamp,
        runtimeId,
        eventType: 'RISK',
        eventName: 'RISK_GATE_EVALUATED',
        market,
        action: risk,
        summary: `${market} Risk Gate ${risk}.`,
        reason: String(item?.riskReasons?.[0] ?? firstReason(item) ?? 'Risk Gate recorded no explicit reason.'),
        severity: risk === 'REJECT' ? 'WARN' : 'INFO',
        authority: 'execution_gate',
        executionAuthority: true,
        source: 'risk_gate',
        trace: { riskDisposition: risk, riskReasons: item?.riskReasons ?? [], tradeMap: item?.tradeMap ?? null },
      });
    }

    events.push({
      eventKey: `${prefix}:decision`,
      occurredAt: timestamp,
      runtimeId,
      eventType: 'DECISION',
      eventName: `DECISION_${decision}`,
      market,
      strategyId: strategy,
      strategyVersion: item?.strategyVersion == null ? null : String(item.strategyVersion),
      action: decision,
      summary: `${market} decision: ${decision}.`,
      reason: firstReason(item),
      severity: decision === 'NO_TRADE' ? 'INFO' : 'INFO',
      authority: 'decision_authority',
      executionAuthority: false,
      source: 'paper_runtime',
      trace: {
        decision,
        regime: item?.regime ?? null,
        regimeConfidence: item?.regimeConfidence ?? null,
        oracleTradeScore: item?.oracleTradeScore ?? null,
        confidence: item?.confidence ?? null,
        strategyDisposition: strategy,
        router: item?.router ?? null,
        riskDisposition: item?.riskDisposition ?? null,
        primaryReason: item?.primaryReason ?? null,
        reasons: item?.reasons ?? [],
        tradeMap: item?.tradeMap ?? null,
        structure: item?.structure ?? null,
        cycle: item?.cycle ?? null,
        challenger: item?.challenger ?? null,
      },
      links: { evidenceIds },
    });

    if (decision === 'ENTER' || decision === 'EXIT' || String(item?.action ?? '') === 'ENTER' || String(item?.action ?? '') === 'EXIT') {
      const tradeAction = decision === 'ENTER' || decision === 'EXIT' ? decision : String(item.action);
      events.push({
        eventKey: `${prefix}:trade:${tradeAction}`,
        occurredAt: timestamp,
        runtimeId,
        eventType: 'TRADE',
        eventName: tradeAction === 'ENTER' ? 'PAPER_TRADE_ENTERED' : 'PAPER_TRADE_EXITED',
        market,
        strategyId: strategy,
        strategyVersion: item?.strategyVersion == null ? null : String(item.strategyVersion),
        action: tradeAction,
        summary: `${market} Paper trade ${tradeAction} completed by runtime.`,
        reason: firstReason(item),
        authority: 'paper_execution',
        executionAuthority: true,
        source: 'paper_runtime',
        trace: { tradeMap: item?.tradeMap ?? null, riskDisposition: item?.riskDisposition ?? null, oracleTradeScore: item?.oracleTradeScore ?? null },
        links: { evidenceIds },
      });
    }
  }

  for (const review of councilAi?.reviews ?? []) {
    const reviewKey = String(review?.reviewKey ?? `${runtimeId}:${review?.market ?? 'UNKNOWN'}:${Date.now()}`);
    const skipped = Boolean(review?.skipped);
    events.push({
      eventKey: `${reviewKey}:ai-council:${skipped ? 'skipped' : 'reviewed'}`,
      occurredAt: Date.now(),
      runtimeId,
      eventType: 'AI',
      eventName: skipped ? 'AI_COUNCIL_SKIPPED' : 'AI_COUNCIL_REVIEWED',
      market: review?.market == null ? null : String(review.market),
      action: review?.action == null ? null : String(review.action),
      summary: skipped
        ? `AI Shadow Council skipped for ${String(review?.market ?? 'unknown')}.`
        : `AI Shadow Council ${String(review?.stance ?? 'REVIEWED')} for ${String(review?.market ?? 'unknown')} using ${String(review?.model ?? 'unknown model')}.`,
      reason: String(review?.skipReason ?? review?.escalationReason ?? review?.rationale ?? ''),
      severity: skipped ? 'WARN' : review?.stance === 'DISSENT' ? 'WARN' : 'INFO',
      authority: 'advisory_shadow',
      executionAuthority: false,
      source: 'ai_council',
      trace: review,
      links: { reviewKey },
    });
  }

  return events;
};

export const buildStrategyFactoryCanonicalEvents = (run: any, options: {
  market: string;
  unit: number;
  seed: number;
  seedSource: string;
  aiResearch?: any;
}): CanonicalEventInput[] => {
  const runId = String(run?.id ?? run?.runId ?? `sf-${options.market}-${options.unit}-${options.seed}-${run?.startedAt ?? Date.now()}`);
  const occurredAt = numberOrNow(run?.finishedAt, Date.now());
  const topResults = Array.isArray(run?.topResults) ? run.topResults : Array.isArray(run?.top_results) ? run.top_results : [];
  const events: CanonicalEventInput[] = [{
    eventKey: `${runId}:experiment`,
    occurredAt,
    eventType: 'EXPERIMENT',
    eventName: 'STRATEGY_FACTORY_RUN_COMPLETED',
    market: options.market,
    action: 'RESEARCH_ONLY',
    summary: `Strategy Factory completed for ${options.market}: ${topResults.length} top result(s) recorded; automatic promotion remains disabled.`,
    reason: `Seed source ${options.seedSource}; human approval required before any promotion or deployment.`,
    authority: 'research_only',
    executionAuthority: false,
    source: 'strategy_factory',
    trace: {
      runId,
      market: options.market,
      unit: options.unit,
      seed: options.seed,
      seedSource: options.seedSource,
      statusCounts: run?.statusCounts ?? run?.status_counts ?? null,
      lifecycleCounts: run?.lifecycleCounts ?? run?.lifecycle_counts ?? null,
      candidateCount: run?.candidateCount ?? run?.candidate_count ?? null,
      generationCount: run?.generationCount ?? run?.generation_count ?? null,
      automaticChampionPromotion: false,
      automaticLiveDeployment: false,
    },
    links: { runId },
  }];

  if (options.aiResearch) {
    events.push({
      eventKey: `${runId}:ai-research`,
      occurredAt,
      eventType: 'AI',
      eventName: options.aiResearch?.skipped ? 'AI_STRATEGY_RESEARCH_SKIPPED' : 'AI_STRATEGY_RESEARCH_USED',
      market: options.market,
      action: 'RESEARCH_ONLY',
      summary: options.aiResearch?.skipped
        ? `AI strategy research was skipped for ${options.market}.`
        : `AI strategy research supplied bounded generation-one hypotheses for ${options.market}.`,
      reason: String(options.aiResearch?.skipReason ?? 'AI hypotheses cannot grant execution or promotion authority.'),
      authority: 'research_only',
      executionAuthority: false,
      source: 'strategy_hypothesis_researcher',
      trace: options.aiResearch,
      links: { runId },
    });
  }

  for (const result of topResults.slice(0, 30)) {
    const genome = result?.genome ?? {};
    const evaluation = result?.evaluation ?? {};
    const strategyId = String(genome?.id ?? result?.strategyId ?? 'unknown-strategy');
    const status = String(evaluation?.status ?? result?.status ?? 'OBSERVED');
    const score = Number(evaluation?.score ?? result?.score ?? NaN);
    events.push({
      eventKey: `${runId}:strategy:${strategyId}`,
      occurredAt,
      eventType: 'STRATEGY',
      eventName: 'STRATEGY_TESTED',
      market: options.market,
      strategyId,
      action: status,
      summary: `${strategyId} tested: ${status}${Number.isFinite(score) ? ` · score ${score.toFixed(2)}` : ''}.`,
      reason: String(evaluation?.fatalReasons?.[0] ?? evaluation?.hardGateReasons?.[0] ?? result?.reasons?.[0] ?? 'No primary evaluation reason recorded.'),
      severity: status === 'BLOCKED' ? 'WARN' : 'INFO',
      authority: 'research_only',
      executionAuthority: false,
      source: 'strategy_factory',
      trace: {
        genome,
        evaluation,
        metrics: result?.metrics ?? null,
        tradeCount: result?.tradeCount ?? null,
        oosTradeCount: result?.oosTradeCount ?? null,
        blindTradeCount: result?.blindTradeCount ?? null,
      },
      links: { runId, hypothesisId: result?.hypothesis?.id ?? null },
    });
  }

  return events;
};
