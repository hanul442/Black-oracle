import type { CanonicalEventRow } from './eventLedger';
import {
  buildDirectionalOutcomeCalibration,
  buildEmpiricalReturnDistribution,
  extractDirectionalForecast,
  type DirectionalOutcomeCalibration,
} from './eventLedgerForecastCalibration';

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key
    ? {
        base,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
      }
    : null;
};

const mapRow = (row: any): CanonicalEventRow => ({
  id: String(row.id ?? ''),
  eventKey: String(row.event_key ?? ''),
  occurredAt: row.occurred_at ? Date.parse(row.occurred_at) : 0,
  recordedAt: row.recorded_at ? Date.parse(row.recorded_at) : 0,
  runtimeId: row.runtime_id == null ? null : String(row.runtime_id),
  eventType: String(row.event_type ?? 'SYSTEM') as CanonicalEventRow['eventType'],
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

export const buildDecisionReplayRestUrl = (
  base: string,
  runtimeId: string,
  jsonColumn: 'trace' | 'links',
  jsonKey: 'traceId' | 'entryTraceId',
  value: string,
) => {
  const url = new URL(`${base.replace(/\/+$/, '')}/rest/v1/black_oracle_events`);
  url.searchParams.set('select', '*');
  url.searchParams.set('runtime_id', `eq.${runtimeId}`);
  url.searchParams.set(`${jsonColumn}->>${jsonKey}`, `eq.${value}`);
  url.searchParams.set('order', 'occurred_at.asc,recorded_at.asc');
  url.searchParams.set('limit', '200');
  return url;
};

export const buildOutcomeHistoryRestUrl = (
  base: string,
  runtimeId: string,
  market: string,
  limit = 40,
) => {
  const url = new URL(`${base.replace(/\/+$/, '')}/rest/v1/black_oracle_events`);
  url.searchParams.set('select', '*');
  url.searchParams.set('runtime_id', `eq.${runtimeId}`);
  url.searchParams.set('event_type', 'eq.OUTCOME');
  url.searchParams.set('market', `eq.${market}`);
  url.searchParams.set('order', 'occurred_at.desc,recorded_at.desc');
  url.searchParams.set('limit', String(Math.max(1, Math.min(100, Math.trunc(limit)))));
  return url;
};

export const buildMarketHistoryRestUrl = (
  base: string,
  runtimeId: string,
  market: string,
  limit = 800,
) => {
  const url = new URL(`${base.replace(/\/+$/, '')}/rest/v1/black_oracle_events`);
  url.searchParams.set('select', '*');
  url.searchParams.set('runtime_id', `eq.${runtimeId}`);
  url.searchParams.set('market', `eq.${market}`);
  url.searchParams.set('order', 'occurred_at.desc,recorded_at.desc');
  url.searchParams.set('limit', String(Math.max(1, Math.min(2_000, Math.trunc(limit)))));
  return url;
};

const readRows = async (url: URL): Promise<CanonicalEventRow[]> => {
  const db = dbConfig();
  if (!db) return [];
  const response = await fetch(url, {
    headers: db.headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Decision Replay read failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  return ((await response.json()) as any[]).map(mapRow);
};

const readByJsonLink = async (
  runtimeId: string,
  jsonColumn: 'trace' | 'links',
  jsonKey: 'traceId' | 'entryTraceId',
  value: string,
): Promise<CanonicalEventRow[]> => {
  const db = dbConfig();
  if (!db) return [];
  return readRows(buildDecisionReplayRestUrl(db.base, runtimeId, jsonColumn, jsonKey, value));
};

const readOutcomeHistory = async (
  runtimeId: string,
  market: string,
  limit = 40,
): Promise<CanonicalEventRow[]> => {
  const db = dbConfig();
  if (!db) return [];
  return readRows(buildOutcomeHistoryRestUrl(db.base, runtimeId, market, limit));
};

const readMarketHistory = async (
  runtimeId: string,
  market: string,
  limit = 800,
): Promise<CanonicalEventRow[]> => {
  const db = dbConfig();
  if (!db) return [];
  return readRows(buildMarketHistoryRestUrl(db.base, runtimeId, market, limit));
};

const traceIdOf = (event: CanonicalEventRow) =>
  typeof event.trace?.traceId === 'string' && event.trace.traceId ? event.trace.traceId : null;
const entryTraceIdOf = (event: CanonicalEventRow) =>
  typeof event.links?.entryTraceId === 'string' && event.links.entryTraceId ? event.links.entryTraceId : null;
const finiteTimestamp = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const entryDecision = (event: CanonicalEventRow) => event.eventType === 'DECISION'
  && (String(event.action ?? '').toUpperCase() === 'ENTER' || event.eventName === 'DECISION_ENTER');

export const resolveObservedEntryTraceId = (
  outcome: CanonicalEventRow,
  marketEvents: CanonicalEventRow[],
) => {
  const linked = entryTraceIdOf(outcome);
  if (linked && marketEvents.some((event) => traceIdOf(event) === linked)) {
    return { traceId: linked, method: 'EXPLICIT_LINK' as const };
  }

  const openedAt = finiteTimestamp(outcome.trace?.openedAt);
  if (openedAt == null) return { traceId: linked, method: linked ? 'UNRESOLVED_LINK' as const : 'UNAVAILABLE' as const };
  const candidates = marketEvents
    .filter(entryDecision)
    .map((event) => ({ event, distance: Math.abs(event.occurredAt - openedAt), traceId: traceIdOf(event) }))
    .filter((item): item is { event: CanonicalEventRow; distance: number; traceId: string } => Boolean(item.traceId))
    .filter((item) => item.distance <= 5 * 60_000)
    .sort((a, b) => a.distance - b.distance || a.event.occurredAt - b.event.occurredAt);
  const nearest = candidates[0];
  return nearest
    ? { traceId: nearest.traceId, method: 'OPENED_AT_NEAREST_DECISION' as const }
    : { traceId: linked, method: linked ? 'UNRESOLVED_LINK' as const : 'UNAVAILABLE' as const };
};

const withResolvedEntryLink = (
  outcome: CanonicalEventRow,
  marketEvents: CanonicalEventRow[],
): CanonicalEventRow => {
  const resolved = resolveObservedEntryTraceId(outcome, marketEvents);
  if (!resolved.traceId || resolved.traceId === entryTraceIdOf(outcome)) return outcome;
  return {
    ...outcome,
    links: {
      ...outcome.links,
      entryTraceIdRaw: entryTraceIdOf(outcome),
      entryTraceId: resolved.traceId,
      entryTraceResolution: resolved.method,
    },
  };
};

export const mergeDecisionReplayTimeline = (...groups: CanonicalEventRow[][]) => {
  const byId = new Map<string, CanonicalEventRow>();
  for (const event of groups.flat()) {
    const key = event.id || event.eventKey;
    if (!byId.has(key)) byId.set(key, event);
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.occurredAt - b.occurredAt || a.recordedAt - b.recordedAt || a.eventKey.localeCompare(b.eventKey));
};

const buildHistoricalCalibration = (
  marketEvents: CanonicalEventRow[],
  outcomes: CanonicalEventRow[],
  targetProbabilityBullish: number | null,
) => {
  const resolvedOutcomes = outcomes.map((outcome) => withResolvedEntryLink(outcome, marketEvents));
  const historyTimeline = mergeDecisionReplayTimeline(marketEvents, resolvedOutcomes);
  const calibrations = resolvedOutcomes
    .map((outcome) => buildDirectionalOutcomeCalibration(historyTimeline, outcome))
    .filter((value): value is DirectionalOutcomeCalibration => Boolean(value));
  return {
    calibrations,
    distribution: buildEmpiricalReturnDistribution(calibrations, targetProbabilityBullish, 8),
  };
};

export const readDecisionReplay = async (traceId: string, runtimeId: string) => {
  const normalizedTraceId = String(traceId ?? '').trim();
  const normalizedRuntimeId = String(runtimeId ?? '').trim();
  if (!normalizedTraceId) throw new Error('Decision Replay requires traceId.');
  if (!normalizedRuntimeId) throw new Error('Decision Replay requires runtimeId.');

  const primary = await readByJsonLink(normalizedRuntimeId, 'trace', 'traceId', normalizedTraceId);
  const primaryMarket = primary.find((event) => event.market)?.market ?? null;
  const [explicitDirectOutcomes, marketOutcomes, marketHistory] = primaryMarket
    ? await Promise.all([
        readByJsonLink(normalizedRuntimeId, 'links', 'entryTraceId', normalizedTraceId),
        readOutcomeHistory(normalizedRuntimeId, primaryMarket, 40),
        readMarketHistory(normalizedRuntimeId, primaryMarket, 800),
      ])
    : [
        await readByJsonLink(normalizedRuntimeId, 'links', 'entryTraceId', normalizedTraceId),
        [] as CanonicalEventRow[],
        [] as CanonicalEventRow[],
      ];

  const resolvedMarketOutcomes = marketOutcomes.map((outcome) => withResolvedEntryLink(outcome, marketHistory));
  const recoveredDirectOutcomes = resolvedMarketOutcomes.filter((outcome) => entryTraceIdOf(outcome) === normalizedTraceId);
  const directOutcomes = mergeDecisionReplayTimeline(explicitDirectOutcomes, recoveredDirectOutcomes);

  const relatedTraceIds = new Set<string>();
  for (const event of [...primary, ...directOutcomes]) {
    const eventTraceId = traceIdOf(event);
    const entryTraceId = entryTraceIdOf(event);
    if (eventTraceId && eventTraceId !== normalizedTraceId) relatedTraceIds.add(eventTraceId);
    if (entryTraceId && entryTraceId !== normalizedTraceId) relatedTraceIds.add(entryTraceId);
  }

  const relatedGroups: CanonicalEventRow[][] = [];
  for (const relatedTraceId of Array.from(relatedTraceIds).slice(0, 4)) {
    const cached = marketHistory.filter((event) => traceIdOf(event) === relatedTraceId);
    relatedGroups.push(cached.length ? cached : await readByJsonLink(normalizedRuntimeId, 'trace', 'traceId', relatedTraceId));
  }

  let timeline = mergeDecisionReplayTimeline(primary, directOutcomes, ...relatedGroups);
  const timelineOutcomes = timeline
    .filter((event) => event.eventType === 'OUTCOME')
    .map((outcome) => withResolvedEntryLink(outcome, marketHistory));
  timeline = mergeDecisionReplayTimeline(
    timeline.filter((event) => event.eventType !== 'OUTCOME'),
    timelineOutcomes,
  );

  const entryTraceIds = Array.from(new Set(timeline.map(entryTraceIdOf).filter((value): value is string => Boolean(value))));
  const traceIds = Array.from(new Set(timeline.map(traceIdOf).filter((value): value is string => Boolean(value))));
  const currentOutcomeCalibrations = timelineOutcomes
    .map((outcome) => buildDirectionalOutcomeCalibration(timeline, outcome))
    .filter((value): value is DirectionalOutcomeCalibration => Boolean(value));

  const linkedEntryTraceId = entryTraceIds[0] ?? null;
  const targetForecast = extractDirectionalForecast(timeline, normalizedTraceId)
    ?? extractDirectionalForecast(timeline, linkedEntryTraceId);
  const market = primaryMarket
    ?? directOutcomes.find((event) => event.market)?.market
    ?? timeline.find((event) => event.market)?.market
    ?? null;

  let historicalCalibrations: DirectionalOutcomeCalibration[] = [];
  let distribution = buildEmpiricalReturnDistribution([], targetForecast?.probabilityBullish ?? null, 8);
  let historyError: string | null = null;
  if (market) {
    try {
      const historyEvents = market === primaryMarket ? marketHistory : await readMarketHistory(normalizedRuntimeId, market, 800);
      const outcomes = market === primaryMarket ? marketOutcomes : await readOutcomeHistory(normalizedRuntimeId, market, 40);
      const historical = buildHistoricalCalibration(historyEvents, outcomes, targetForecast?.probabilityBullish ?? null);
      historicalCalibrations = historical.calibrations;
      distribution = historical.distribution;
    } catch (error) {
      historyError = error instanceof Error ? error.message : 'Historical calibration read failed.';
    }
  }

  return {
    runtimeId: normalizedRuntimeId,
    requestedTraceId: normalizedTraceId,
    found: primary.length > 0 || directOutcomes.length > 0,
    primaryCount: primary.length,
    timelineCount: timeline.length,
    traceIds,
    entryTraceIds,
    completeThrough: timeline.some((event) => event.eventType === 'OUTCOME') ? 'OUTCOME' : 'CURRENT_TRACE',
    forecastCalibration: {
      targetForecast,
      currentOutcomes: currentOutcomeCalibrations,
      empiricalReturnDistribution: distribution,
      historicalCalibratedOutcomes: historicalCalibrations.length,
      historyError,
    },
    timeline,
  };
};
