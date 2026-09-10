export const S2_STRATEGY_RESEARCH_RUNTIME_ID = 'black-oracle-paper-s2-shadow';

export type StrategyShadowLifecycle = 'CHALLENGER' | 'CHAMPION_CANDIDATE';

export type StrategyShadowCandidate = {
  strategyId: string;
  runId: string | null;
  market: string;
  lifecycle: StrategyShadowLifecycle;
  score: number;
  generation: number | null;
  indicators: string[];
  metrics: Record<string, unknown> | null;
  occurredAt: number;
  sourceEventKey: string;
  executionAuthority: false;
  promotionAuthority: false;
};

export type StrategyShadowPoolSnapshot = {
  available: boolean;
  runtimeId: string;
  market: string;
  candidateCount: number;
  candidates: StrategyShadowCandidate[];
  source: 'canonical_strategy_test_events';
  executionAuthority: false;
  promotionAuthority: false;
  reason: string;
};

const normalizeMarket = (value: unknown) => String(value ?? '').trim().toUpperCase();
const finiteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const boundedStrings = (value: unknown, max = 16) => Array.isArray(value)
  ? value.slice(0, max).map((item) => String(item).slice(0, 120))
  : [];

const lifecycleOf = (row: any): StrategyShadowLifecycle | null => {
  const lifecycle = String(row?.trace?.evaluation?.lifecycle ?? '').toUpperCase();
  return lifecycle === 'CHALLENGER' || lifecycle === 'CHAMPION_CANDIDATE'
    ? lifecycle
    : null;
};

export const buildStrategyShadowPoolFromCanonicalEvents = (
  rows: any[],
  market: string,
  limit = 8,
): StrategyShadowPoolSnapshot => {
  const normalizedMarket = normalizeMarket(market);
  const boundedLimit = Math.max(1, Math.min(20, Math.trunc(Number(limit) || 8)));
  const byStrategy = new Map<string, StrategyShadowCandidate>();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (String(row?.runtime_id ?? '') !== S2_STRATEGY_RESEARCH_RUNTIME_ID) continue;
    if (String(row?.event_type ?? '') !== 'STRATEGY') continue;
    if (String(row?.event_name ?? '') !== 'STRATEGY_TESTED') continue;
    if (normalizeMarket(row?.market) !== normalizedMarket) continue;
    if (row?.execution_authority !== false) continue;

    const evaluation = row?.trace?.evaluation;
    const genome = row?.trace?.genome;
    const lifecycle = lifecycleOf(row);
    if (!evaluation || evaluation.hardGatePassed !== true || !lifecycle) continue;
    if (evaluation.requiresHumanApproval !== true) continue;
    if (!genome || genome.executionAuthority !== false || genome.promotionAuthority !== false) continue;

    const strategyId = String(row?.strategy_id ?? genome?.id ?? '').trim();
    const score = finiteNumber(evaluation?.score);
    if (!strategyId || score == null) continue;

    const occurredAt = Date.parse(String(row?.occurred_at ?? ''));
    const candidate: StrategyShadowCandidate = {
      strategyId,
      runId: row?.links?.runId == null ? null : String(row.links.runId),
      market: normalizedMarket,
      lifecycle,
      score,
      generation: finiteNumber(genome?.generation),
      indicators: boundedStrings(genome?.indicators),
      metrics: row?.trace?.metrics && typeof row.trace.metrics === 'object' ? { ...row.trace.metrics } : null,
      occurredAt: Number.isFinite(occurredAt) ? occurredAt : 0,
      sourceEventKey: String(row?.event_key ?? ''),
      executionAuthority: false,
      promotionAuthority: false,
    };

    const previous = byStrategy.get(strategyId);
    if (!previous || candidate.occurredAt >= previous.occurredAt) byStrategy.set(strategyId, candidate);
  }

  const candidates = Array.from(byStrategy.values())
    .sort((a, b) => b.score - a.score || b.occurredAt - a.occurredAt || a.strategyId.localeCompare(b.strategyId))
    .slice(0, boundedLimit);

  return {
    available: true,
    runtimeId: S2_STRATEGY_RESEARCH_RUNTIME_ID,
    market: normalizedMarket,
    candidateCount: candidates.length,
    candidates,
    source: 'canonical_strategy_test_events',
    executionAuthority: false,
    promotionAuthority: false,
    reason: candidates.length
      ? `${candidates.length} Hard-Gate-passed Strategy Factory candidate(s) are visible to the S2 shadow research plane only.`
      : 'No S2 Strategy Factory candidate has passed the Hard Gate for this market.',
  };
};

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

export const readStrategyShadowPool = async (
  market: string,
  limit = 8,
): Promise<StrategyShadowPoolSnapshot> => {
  const normalizedMarket = normalizeMarket(market);
  if (!/^(KRW-[A-Z0-9]+|KRX-\d{6})$/.test(normalizedMarket)) {
    throw new Error('Strategy shadow pool requires a normalized KRW-* or KRX-###### market.');
  }

  const db = dbConfig();
  if (!db) {
    return {
      available: false,
      runtimeId: S2_STRATEGY_RESEARCH_RUNTIME_ID,
      market: normalizedMarket,
      candidateCount: 0,
      candidates: [],
      source: 'canonical_strategy_test_events',
      executionAuthority: false,
      promotionAuthority: false,
      reason: 'Supabase is not configured, so the S2 Strategy shadow pool cannot be read.',
    };
  }

  const url = new URL(`${db.base}/rest/v1/black_oracle_events`);
  url.searchParams.set('select', 'event_key,occurred_at,runtime_id,event_type,event_name,market,strategy_id,execution_authority,trace,links');
  url.searchParams.set('runtime_id', `eq.${S2_STRATEGY_RESEARCH_RUNTIME_ID}`);
  url.searchParams.set('event_type', 'eq.STRATEGY');
  url.searchParams.set('event_name', 'eq.STRATEGY_TESTED');
  url.searchParams.set('market', `eq.${normalizedMarket}`);
  url.searchParams.set('execution_authority', 'eq.false');
  url.searchParams.set('order', 'occurred_at.desc');
  url.searchParams.set('limit', '200');

  const response = await fetch(url, {
    headers: db.headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Strategy shadow pool read failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }

  return buildStrategyShadowPoolFromCanonicalEvents(await response.json(), normalizedMarket, limit);
};
