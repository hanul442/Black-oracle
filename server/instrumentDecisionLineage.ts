import type { CanonicalEventRow, CanonicalEventType } from './eventLedger';

export const instrumentLineageTypes = [
  'EVIDENCE',
  'STRATEGY',
  'COUNCIL',
  'DECISION',
  'RISK',
  'ORDER',
  'TRADE',
  'OUTCOME',
] as const satisfies readonly CanonicalEventType[];

export type InstrumentLineageType = (typeof instrumentLineageTypes)[number];
export type InstrumentLineageStageStatus = 'LINKED' | 'NOT_LINKED';
export type InstrumentLineageStatus = 'COMPLETE' | 'PARTIAL' | 'DATA_GAP';
export type InstrumentLineageLinkMethod = 'TRACE_ID' | 'ENTRY_TRACE_ID' | null;

const nonEmptyText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * Returns only the event's own canonical trace identity.
 * entryTraceId is deliberately excluded because it links an exit/outcome back to
 * an entry decision; treating it as the event's own trace would collapse distinct
 * lifecycle traces into one synthetic lineage.
 */
export const directTraceIdOf = (event: Pick<CanonicalEventRow, 'trace' | 'links'> | null | undefined) =>
  nonEmptyText(event?.trace?.traceId)
  ?? nonEmptyText(event?.trace?.trace_id)
  ?? nonEmptyText(event?.links?.traceId)
  ?? nonEmptyText(event?.links?.trace_id);

export const entryTraceIdOf = (event: Pick<CanonicalEventRow, 'links'> | null | undefined) =>
  nonEmptyText(event?.links?.entryTraceId)
  ?? nonEmptyText(event?.links?.entry_trace_id);

export const explicitTraceLinkMethod = (
  event: Pick<CanonicalEventRow, 'trace' | 'links'>,
  traceId: string,
): InstrumentLineageLinkMethod => {
  if (!traceId) return null;
  if (directTraceIdOf(event) === traceId) return 'TRACE_ID';
  if (entryTraceIdOf(event) === traceId) return 'ENTRY_TRACE_ID';
  return null;
};

const newestFirst = (events: CanonicalEventRow[]) => [...events].sort((a, b) =>
  Number(b.occurredAt ?? 0) - Number(a.occurredAt ?? 0)
  || Number(b.recordedAt ?? 0) - Number(a.recordedAt ?? 0)
  || String(b.eventKey ?? '').localeCompare(String(a.eventKey ?? '')));

export const latestObservedByType = (events: CanonicalEventRow[]) => {
  const ordered = newestFirst(events);
  return Object.fromEntries(instrumentLineageTypes.map((type) => [
    type,
    ordered.find((event) => String(event.eventType).toUpperCase() === type) ?? null,
  ])) as Record<InstrumentLineageType, CanonicalEventRow | null>;
};

export const selectInstrumentAnalysisAnchor = (events: CanonicalEventRow[]) => {
  const observed = latestObservedByType(events);
  return observed.DECISION ?? observed.COUNCIL ?? observed.STRATEGY ?? newestFirst(events)[0] ?? null;
};

export const buildInstrumentDecisionLineage = (
  events: CanonicalEventRow[],
  currentTraceId: string | null,
) => {
  const ordered = newestFirst(events);
  const explicitEvents = currentTraceId
    ? ordered.filter((event) => explicitTraceLinkMethod(event, currentTraceId) !== null)
    : [];

  const latestByType = Object.fromEntries(instrumentLineageTypes.map((type) => [
    type,
    explicitEvents.find((event) => String(event.eventType).toUpperCase() === type) ?? null,
  ])) as Record<InstrumentLineageType, CanonicalEventRow | null>;

  const stages = Object.fromEntries(instrumentLineageTypes.map((type) => {
    const event = latestByType[type];
    return [type, {
      status: (event ? 'LINKED' : 'NOT_LINKED') as InstrumentLineageStageStatus,
      event,
      linkMethod: event && currentTraceId ? explicitTraceLinkMethod(event, currentTraceId) : null,
    }];
  })) as Record<InstrumentLineageType, {
    status: InstrumentLineageStageStatus;
    event: CanonicalEventRow | null;
    linkMethod: InstrumentLineageLinkMethod;
  }>;

  const linkedStageCount = instrumentLineageTypes.reduce(
    (count, type) => count + (stages[type].status === 'LINKED' ? 1 : 0),
    0,
  );
  const status: InstrumentLineageStatus = !currentTraceId
    ? 'DATA_GAP'
    : linkedStageCount === instrumentLineageTypes.length
      ? 'COMPLETE'
      : 'PARTIAL';

  return {
    status,
    traceId: currentTraceId,
    scope: 'CANDIDATE_DECISION' as const,
    linkagePolicy: 'EXPLICIT_ONLY' as const,
    linkedStageCount,
    requiredStageCount: instrumentLineageTypes.length,
    stages,
    latestByType,
    events: explicitEvents,
  };
};
