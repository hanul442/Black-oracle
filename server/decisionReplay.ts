import type { CanonicalEventRow } from './eventLedger';

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

const readByJsonLink = async (
  runtimeId: string,
  jsonColumn: 'trace' | 'links',
  jsonKey: 'traceId' | 'entryTraceId',
  value: string,
): Promise<CanonicalEventRow[]> => {
  const db = dbConfig();
  if (!db) return [];
  const response = await fetch(buildDecisionReplayRestUrl(db.base, runtimeId, jsonColumn, jsonKey, value), {
    headers: db.headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Decision Replay read failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  return ((await response.json()) as any[]).map(mapRow);
};

const traceIdOf = (event: CanonicalEventRow) =>
  typeof event.trace?.traceId === 'string' && event.trace.traceId ? event.trace.traceId : null;
const entryTraceIdOf = (event: CanonicalEventRow) =>
  typeof event.links?.entryTraceId === 'string' && event.links.entryTraceId ? event.links.entryTraceId : null;

export const mergeDecisionReplayTimeline = (...groups: CanonicalEventRow[][]) => {
  const byId = new Map<string, CanonicalEventRow>();
  for (const event of groups.flat()) {
    const key = event.id || event.eventKey;
    if (!byId.has(key)) byId.set(key, event);
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.occurredAt - b.occurredAt || a.recordedAt - b.recordedAt || a.eventKey.localeCompare(b.eventKey));
};

export const readDecisionReplay = async (traceId: string, runtimeId: string) => {
  const normalizedTraceId = String(traceId ?? '').trim();
  const normalizedRuntimeId = String(runtimeId ?? '').trim();
  if (!normalizedTraceId) throw new Error('Decision Replay requires traceId.');
  if (!normalizedRuntimeId) throw new Error('Decision Replay requires runtimeId.');

  const primary = await readByJsonLink(normalizedRuntimeId, 'trace', 'traceId', normalizedTraceId);
  const directOutcomes = await readByJsonLink(normalizedRuntimeId, 'links', 'entryTraceId', normalizedTraceId);

  const relatedTraceIds = new Set<string>();
  for (const event of [...primary, ...directOutcomes]) {
    const eventTraceId = traceIdOf(event);
    const entryTraceId = entryTraceIdOf(event);
    if (eventTraceId && eventTraceId !== normalizedTraceId) relatedTraceIds.add(eventTraceId);
    if (entryTraceId && entryTraceId !== normalizedTraceId) relatedTraceIds.add(entryTraceId);
  }

  const relatedGroups: CanonicalEventRow[][] = [];
  for (const relatedTraceId of Array.from(relatedTraceIds).slice(0, 4)) {
    relatedGroups.push(await readByJsonLink(normalizedRuntimeId, 'trace', 'traceId', relatedTraceId));
  }

  const timeline = mergeDecisionReplayTimeline(primary, directOutcomes, ...relatedGroups);
  const entryTraceIds = Array.from(new Set(timeline.map(entryTraceIdOf).filter((value): value is string => Boolean(value))));
  const traceIds = Array.from(new Set(timeline.map(traceIdOf).filter((value): value is string => Boolean(value))));

  return {
    runtimeId: normalizedRuntimeId,
    requestedTraceId: normalizedTraceId,
    found: primary.length > 0 || directOutcomes.length > 0,
    primaryCount: primary.length,
    timelineCount: timeline.length,
    traceIds,
    entryTraceIds,
    completeThrough: timeline.some((event) => event.eventType === 'OUTCOME') ? 'OUTCOME' : 'CURRENT_TRACE',
    timeline,
  };
};
