export type IntegrityIncidentKind =
  | 'DAILY_RISK_BREACH'
  | 'RISK_BYPASS'
  | 'EXECUTION_INTEGRITY'
  | 'RUNTIME_FATAL';

export type IntegritySeverity = 'WARNING' | 'CRITICAL';
export type IntegrityEventType =
  | 'OBSERVABILITY_STARTED'
  | 'INCIDENT_OPENED'
  | 'INCIDENT_ACKNOWLEDGED'
  | 'INCIDENT_RESOLVED';

export interface IntegrityLedgerEvent {
  id: string;
  timestamp: number;
  type: IntegrityEventType;
  incidentId: string | null;
  incidentKind: IntegrityIncidentKind | null;
  severity: IntegritySeverity | null;
  market: string | null;
  cycleNumber: number | null;
  dedupeKey: string | null;
  actor: string | null;
  note: string | null;
  message: string;
}

export interface IntegrityLedgerCheckpoint {
  schemaVersion: 1;
  startedAt: number;
  events: IntegrityLedgerEvent[];
}

export interface IntegrityIncidentSnapshot {
  incidentId: string;
  kind: IntegrityIncidentKind;
  severity: IntegritySeverity;
  openedAt: number;
  acknowledgedAt: number | null;
  resolvedAt: number | null;
  status: 'UNACKNOWLEDGED' | 'ACKNOWLEDGED' | 'RESOLVED';
  market: string | null;
  cycleNumber: number | null;
  dedupeKey: string | null;
  message: string;
  actor: string | null;
  note: string | null;
}

export interface IntegrityLedgerSummary {
  startedAt: number | null;
  coverageDays: number;
  requiredCoverageDays: number;
  coverageComplete: boolean;
  totalIncidents: number;
  dailyRiskBreaches: number | null;
  riskBypasses: number | null;
  executionIntegrityViolations: number | null;
  fatalRuntimeIncidents: number | null;
  unresolvedCriticalIncidents: number | null;
  incidents: IntegrityIncidentSnapshot[];
  reasons: string[];
}

const cloneEvent = (event: IntegrityLedgerEvent): IntegrityLedgerEvent => ({ ...event });
const validTimestamp = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0;
const fnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const createIntegrityLedgerCheckpoint = (startedAt = Date.now()): IntegrityLedgerCheckpoint => {
  if (!validTimestamp(startedAt)) throw new Error('Integrity observability startedAt must be a positive timestamp.');
  const event: IntegrityLedgerEvent = {
    id: `integrity-start-${fnv1a(String(startedAt))}`,
    timestamp: startedAt,
    type: 'OBSERVABILITY_STARTED',
    incidentId: null,
    incidentKind: null,
    severity: null,
    market: null,
    cycleNumber: null,
    dedupeKey: 'integrity-observability-started',
    actor: 'SYSTEM',
    note: null,
    message: 'Append-only runtime integrity observability started.',
  };
  return { schemaVersion: 1, startedAt, events: [event] };
};

export const normalizeIntegrityLedgerCheckpoint = (value: unknown): IntegrityLedgerCheckpoint | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<IntegrityLedgerCheckpoint>;
  if (candidate.schemaVersion !== 1 || !validTimestamp(candidate.startedAt) || !Array.isArray(candidate.events)) return null;
  const events = candidate.events.filter((item): item is IntegrityLedgerEvent => Boolean(
    item && typeof item === 'object' && typeof item.id === 'string' && validTimestamp(item.timestamp) && typeof item.type === 'string',
  )).map(cloneEvent).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  return { schemaVersion: 1, startedAt: Number(candidate.startedAt), events: events.slice(-20_000) };
};

export const buildIntegrityIncidentId = (kind: IntegrityIncidentKind, timestamp: number, dedupeKey: string) =>
  `incident-${kind.toLowerCase()}-${fnv1a(`${kind}|${timestamp}|${dedupeKey}`)}`;

export const buildIncidentOpenedEvent = (input: {
  timestamp?: number;
  kind: IntegrityIncidentKind;
  severity: IntegritySeverity;
  dedupeKey: string;
  message: string;
  market?: string | null;
  cycleNumber?: number | null;
  actor?: string | null;
}): IntegrityLedgerEvent => {
  const timestamp = input.timestamp ?? Date.now();
  const incidentId = buildIntegrityIncidentId(input.kind, timestamp, input.dedupeKey);
  return {
    id: `integrity-open-${incidentId}`,
    timestamp,
    type: 'INCIDENT_OPENED',
    incidentId,
    incidentKind: input.kind,
    severity: input.severity,
    market: input.market?.toUpperCase() ?? null,
    cycleNumber: input.cycleNumber ?? null,
    dedupeKey: input.dedupeKey,
    actor: input.actor ?? 'SYSTEM',
    note: null,
    message: input.message,
  };
};

export const buildIncidentTransitionEvent = (input: {
  incident: IntegrityIncidentSnapshot;
  type: 'INCIDENT_ACKNOWLEDGED' | 'INCIDENT_RESOLVED';
  actor: string;
  note?: string | null;
  timestamp?: number;
}): IntegrityLedgerEvent => {
  if (input.type === 'INCIDENT_ACKNOWLEDGED' && input.incident.status !== 'UNACKNOWLEDGED') {
    throw new Error('Only an unacknowledged incident can be acknowledged.');
  }
  if (input.type === 'INCIDENT_RESOLVED' && input.incident.status === 'RESOLVED') {
    throw new Error('Incident is already resolved.');
  }
  const timestamp = input.timestamp ?? Date.now();
  return {
    id: `integrity-${input.type === 'INCIDENT_ACKNOWLEDGED' ? 'ack' : 'resolve'}-${input.incident.incidentId}-${timestamp}`,
    timestamp,
    type: input.type,
    incidentId: input.incident.incidentId,
    incidentKind: input.incident.kind,
    severity: input.incident.severity,
    market: input.incident.market,
    cycleNumber: input.incident.cycleNumber,
    dedupeKey: input.incident.dedupeKey,
    actor: input.actor,
    note: input.note?.trim() || null,
    message: input.type === 'INCIDENT_ACKNOWLEDGED' ? 'Operator acknowledged incident.' : 'Operator resolved incident.',
  };
};

export const appendIntegrityEvent = (
  checkpoint: IntegrityLedgerCheckpoint,
  event: IntegrityLedgerEvent,
  maxEvents = 20_000,
): IntegrityLedgerCheckpoint => {
  const normalized = normalizeIntegrityLedgerCheckpoint(checkpoint);
  if (!normalized) throw new Error('Integrity ledger checkpoint is invalid.');
  if (normalized.events.some((item) => item.id === event.id)) return normalized;
  const events = [...normalized.events, cloneEvent(event)]
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
    .slice(-Math.max(100, Math.min(50_000, Math.trunc(maxEvents) || 20_000)));
  return { schemaVersion: 1, startedAt: normalized.startedAt, events };
};

export const deriveIntegrityIncidents = (checkpoint: IntegrityLedgerCheckpoint | null | undefined): IntegrityIncidentSnapshot[] => {
  const normalized = normalizeIntegrityLedgerCheckpoint(checkpoint);
  if (!normalized) return [];
  const incidents = new Map<string, IntegrityIncidentSnapshot>();
  for (const event of normalized.events) {
    if (!event.incidentId) continue;
    if (event.type === 'INCIDENT_OPENED' && event.incidentKind && event.severity) {
      if (!incidents.has(event.incidentId)) incidents.set(event.incidentId, {
        incidentId: event.incidentId,
        kind: event.incidentKind,
        severity: event.severity,
        openedAt: event.timestamp,
        acknowledgedAt: null,
        resolvedAt: null,
        status: 'UNACKNOWLEDGED',
        market: event.market,
        cycleNumber: event.cycleNumber,
        dedupeKey: event.dedupeKey,
        message: event.message,
        actor: event.actor,
        note: event.note,
      });
      continue;
    }
    const incident = incidents.get(event.incidentId);
    if (!incident) continue;
    if (event.type === 'INCIDENT_ACKNOWLEDGED' && incident.status === 'UNACKNOWLEDGED') {
      incident.status = 'ACKNOWLEDGED';
      incident.acknowledgedAt = event.timestamp;
      incident.actor = event.actor;
      incident.note = event.note;
    }
    if (event.type === 'INCIDENT_RESOLVED' && incident.status !== 'RESOLVED') {
      incident.status = 'RESOLVED';
      incident.resolvedAt = event.timestamp;
      incident.actor = event.actor;
      incident.note = event.note;
    }
  }
  return Array.from(incidents.values()).sort((a, b) => b.openedAt - a.openedAt);
};

export const summarizeIntegrityLedger = (
  checkpoint: IntegrityLedgerCheckpoint | null | undefined,
  now = Date.now(),
  requiredCoverageDays = 14,
): IntegrityLedgerSummary => {
  const normalized = normalizeIntegrityLedgerCheckpoint(checkpoint);
  if (!normalized) {
    return {
      startedAt: null,
      coverageDays: 0,
      requiredCoverageDays,
      coverageComplete: false,
      totalIncidents: 0,
      dailyRiskBreaches: null,
      riskBypasses: null,
      executionIntegrityViolations: null,
      fatalRuntimeIncidents: null,
      unresolvedCriticalIncidents: null,
      incidents: [],
      reasons: ['Integrity observability has not started; historical zero-incident claims are unavailable.'],
    };
  }
  const coverageDays = Math.max(0, now - normalized.startedAt) / 86_400_000;
  const coverageComplete = coverageDays >= requiredCoverageDays;
  const incidents = deriveIntegrityIncidents(normalized);
  const count = (kind: IntegrityIncidentKind) => incidents.filter((item) => item.kind === kind).length;
  const unresolvedCritical = incidents.filter((item) => item.severity === 'CRITICAL' && item.status !== 'RESOLVED').length;
  return {
    startedAt: normalized.startedAt,
    coverageDays,
    requiredCoverageDays,
    coverageComplete,
    totalIncidents: incidents.length,
    dailyRiskBreaches: coverageComplete ? count('DAILY_RISK_BREACH') : null,
    riskBypasses: coverageComplete ? count('RISK_BYPASS') : null,
    executionIntegrityViolations: coverageComplete ? count('EXECUTION_INTEGRITY') : null,
    fatalRuntimeIncidents: coverageComplete ? count('RUNTIME_FATAL') : null,
    unresolvedCriticalIncidents: coverageComplete ? unresolvedCritical : null,
    incidents,
    reasons: coverageComplete
      ? [`${coverageDays.toFixed(2)} day(s) of append-only integrity observability cover the required ${requiredCoverageDays} day window.`]
      : [`Integrity observability covers ${coverageDays.toFixed(2)}/${requiredCoverageDays} required day(s); zero-incident promotion claims remain unavailable.`],
  };
};
