import { isDeepStrictEqual } from 'node:util';

export const CANONICAL_DATA_CONTRACT_VERSION = 'bo.canonical-data.v1' as const;

export type CanonicalTemporalStatus =
  | 'POINT_IN_TIME_COMPLETE'
  | 'LEGACY_INCOMPLETE';

export type PointInTimeReasonCode =
  | 'ELIGIBLE'
  | 'AS_OF_INVALID'
  | 'EVENT_TIME_INVALID'
  | 'OBSERVED_AT_INVALID'
  | 'INGESTED_AT_INVALID'
  | 'TEMPORAL_ORDER_INVALID'
  | 'OBSERVED_AFTER_AS_OF'
  | 'INGESTED_AFTER_AS_OF'
  | 'REVISION_ID_MISSING'
  | 'LOGICAL_RECORD_ID_MISSING';

export interface CanonicalRevisionIdentity {
  logicalRecordId: string;
  revisionId: string;
  supersedesRevisionId?: string | null;
}

export interface CanonicalTemporalIdentity {
  /**
   * Domain/event time the record describes.
   *
   * This may legitimately be later than the as-of cutoff for information that
   * was already known, such as a scheduled FOMC meeting or earnings date.
   * Point-in-time eligibility is therefore NOT gated on eventTime alone.
   */
  eventTime: string;

  /**
   * Optional time declared by the upstream source.
   * This is provenance metadata, not BLACK ORACLE's knowledge boundary.
   */
  sourcePublishedAt?: string | null;

  /**
   * Earliest time BLACK ORACLE can prove this exact revision was observed.
   */
  observedAt: string;

  /**
   * Time this exact revision entered BLACK ORACLE's canonical data plane.
   */
  ingestedAt: string;
}

export interface CanonicalDataEnvelope<TPayload = unknown> {
  contractVersion: typeof CANONICAL_DATA_CONTRACT_VERSION;
  source: string;
  revision: CanonicalRevisionIdentity;
  temporal: CanonicalTemporalIdentity;
  payload: TPayload;
}

export interface PointInTimeAssessment {
  eligible: boolean;
  reason: PointInTimeReasonCode;
  asOf: string;
  knowledgeAvailableAt: string | null;
}

export interface LegacyTemporalProjection {
  status: CanonicalTemporalStatus;
  eventTime: string | null;
  sourcePublishedAt: string | null;
  observedAt: string | null;
  ingestedAt: string | null;
  logicalRecordId: string | null;
  revisionId: string | null;
  missing: Array<'eventTime' | 'observedAt' | 'ingestedAt' | 'logicalRecordId' | 'revisionId'>;
  invalid: Array<'TEMPORAL_ORDER_INVALID'>;
}

export interface LegacyCanonicalEventLike {
  eventKey?: string | null;
  occurredAt?: number | string | null;
  recordedAt?: number | string | null;
  trace?: Record<string, unknown> | null;
}

const parseTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isoOrNull = (value: unknown): string | null => {
  const parsed = parseTimestamp(value);
  return parsed == null ? null : new Date(parsed).toISOString();
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const explicitTraceString = (
  trace: Record<string, unknown>,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    const value = trace[key];
    if (nonEmpty(value)) return value.trim();
  }
  return null;
};

const explicitTraceTime = (
  trace: Record<string, unknown>,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    const value = isoOrNull(trace[key]);
    if (value) return value;
  }
  return null;
};

export const assessPointInTime = <TPayload>(
  envelope: CanonicalDataEnvelope<TPayload>,
  asOf: string,
): PointInTimeAssessment => {
  const asOfMs = parseTimestamp(asOf);
  if (asOfMs == null) {
    return {
      eligible: false,
      reason: 'AS_OF_INVALID',
      asOf,
      knowledgeAvailableAt: null,
    };
  }

  if (parseTimestamp(envelope.temporal.eventTime) == null) {
    return {
      eligible: false,
      reason: 'EVENT_TIME_INVALID',
      asOf: new Date(asOfMs).toISOString(),
      knowledgeAvailableAt: null,
    };
  }

  if (!nonEmpty(envelope.revision.logicalRecordId)) {
    return {
      eligible: false,
      reason: 'LOGICAL_RECORD_ID_MISSING',
      asOf: new Date(asOfMs).toISOString(),
      knowledgeAvailableAt: null,
    };
  }

  if (!nonEmpty(envelope.revision.revisionId)) {
    return {
      eligible: false,
      reason: 'REVISION_ID_MISSING',
      asOf: new Date(asOfMs).toISOString(),
      knowledgeAvailableAt: null,
    };
  }

  const observedAtMs = parseTimestamp(envelope.temporal.observedAt);
  if (observedAtMs == null) {
    return {
      eligible: false,
      reason: 'OBSERVED_AT_INVALID',
      asOf: new Date(asOfMs).toISOString(),
      knowledgeAvailableAt: null,
    };
  }

  const ingestedAtMs = parseTimestamp(envelope.temporal.ingestedAt);
  if (ingestedAtMs == null) {
    return {
      eligible: false,
      reason: 'INGESTED_AT_INVALID',
      asOf: new Date(asOfMs).toISOString(),
      knowledgeAvailableAt: null,
    };
  }

  const knowledgeAvailableAtMs = Math.max(observedAtMs, ingestedAtMs);
  const normalizedAsOf = new Date(asOfMs).toISOString();
  const knowledgeAvailableAt = new Date(knowledgeAvailableAtMs).toISOString();

  if (ingestedAtMs < observedAtMs) {
    return {
      eligible: false,
      reason: 'TEMPORAL_ORDER_INVALID',
      asOf: normalizedAsOf,
      knowledgeAvailableAt,
    };
  }

  if (observedAtMs > asOfMs) {
    return {
      eligible: false,
      reason: 'OBSERVED_AFTER_AS_OF',
      asOf: normalizedAsOf,
      knowledgeAvailableAt,
    };
  }

  if (ingestedAtMs > asOfMs) {
    return {
      eligible: false,
      reason: 'INGESTED_AFTER_AS_OF',
      asOf: normalizedAsOf,
      knowledgeAvailableAt,
    };
  }

  return {
    eligible: true,
    reason: 'ELIGIBLE',
    asOf: normalizedAsOf,
    knowledgeAvailableAt,
  };
};

/**
 * Returns the newest revision that BLACK ORACLE could actually have known at
 * the requested cutoff. Revisions learned later are excluded even when they
 * refer to an older event time.
 */
export const selectRevisionAsOf = <TPayload>(
  records: readonly CanonicalDataEnvelope<TPayload>[],
  logicalRecordId: string,
  asOf: string,
): CanonicalDataEnvelope<TPayload> | null => {
  const eligible = records
    .filter((record) => record.revision.logicalRecordId === logicalRecordId)
    .filter((record) => assessPointInTime(record, asOf).eligible);

  const byRevisionId = new Map<string, CanonicalDataEnvelope<TPayload>>();
  for (const record of eligible) {
    const revisionId = record.revision.revisionId;
    const existing = byRevisionId.get(revisionId);
    if (existing && !isDeepStrictEqual(existing, record)) {
      throw new Error(
        `conflicting Canonical revision identity: ${logicalRecordId}:${revisionId}`,
      );
    }
    if (!existing) byRevisionId.set(revisionId, record);
  }

  const uniqueEligible = Array.from(byRevisionId.values());
  const supersededRevisionIds = new Set(
    uniqueEligible
      .map((record) => record.revision.supersedesRevisionId)
      .filter((revisionId): revisionId is string => nonEmpty(revisionId)),
  );
  const newestHeads = uniqueEligible.filter(
    (record) => !supersededRevisionIds.has(record.revision.revisionId),
  );

  if (uniqueEligible.length && !newestHeads.length) {
    throw new Error(`invalid revision supersession chain: ${logicalRecordId}`);
  }

  newestHeads.sort((a, b) => {
    const aObserved = parseTimestamp(a.temporal.observedAt) ?? 0;
    const bObserved = parseTimestamp(b.temporal.observedAt) ?? 0;
    if (aObserved !== bObserved) return bObserved - aObserved;

    const aIngested = parseTimestamp(a.temporal.ingestedAt) ?? 0;
    const bIngested = parseTimestamp(b.temporal.ingestedAt) ?? 0;
    if (aIngested !== bIngested) return bIngested - aIngested;

    return b.revision.revisionId.localeCompare(a.revision.revisionId);
  });

  return newestHeads[0] ?? null;
};

/**
 * Compatibility projection for the existing Canonical Event Ledger.
 *
 * IMPORTANT: the legacy row does not prove when BLACK ORACLE first observed a
 * fact, and it does not carry a formal revision identity. This adapter never
 * invents those values. A legacy row becomes POINT_IN_TIME_COMPLETE only when
 * explicit temporal/revision metadata is already present in trace.
 */
export const projectLegacyCanonicalEventTemporal = (
  event: LegacyCanonicalEventLike,
): LegacyTemporalProjection => {
  const trace = event.trace && typeof event.trace === 'object' ? event.trace : {};
  const eventTime = isoOrNull(event.occurredAt);
  const ingestedAt = isoOrNull(event.recordedAt);

  const observedAt = explicitTraceTime(
    trace,
    'observedAt',
    'sourceObservedAt',
    'knowledgeObservedAt',
  );
  const sourcePublishedAt = explicitTraceTime(
    trace,
    'sourcePublishedAt',
    'publishedAt',
  );
  const revisionId = explicitTraceString(trace, 'revisionId');
  const logicalRecordId =
    explicitTraceString(trace, 'logicalRecordId')
    ?? (nonEmpty(event.eventKey) ? event.eventKey.trim() : null);

  const missing: LegacyTemporalProjection['missing'] = [];
  if (!eventTime) missing.push('eventTime');
  if (!observedAt) missing.push('observedAt');
  if (!ingestedAt) missing.push('ingestedAt');
  if (!logicalRecordId) missing.push('logicalRecordId');
  if (!revisionId) missing.push('revisionId');

  const invalid: LegacyTemporalProjection['invalid'] = [];
  if (
    observedAt
    && ingestedAt
    && (parseTimestamp(ingestedAt) ?? 0) < (parseTimestamp(observedAt) ?? 0)
  ) {
    invalid.push('TEMPORAL_ORDER_INVALID');
  }

  return {
    status: missing.length || invalid.length
      ? 'LEGACY_INCOMPLETE'
      : 'POINT_IN_TIME_COMPLETE',
    eventTime,
    sourcePublishedAt,
    observedAt,
    ingestedAt,
    logicalRecordId,
    revisionId,
    missing,
    invalid,
  };
};
