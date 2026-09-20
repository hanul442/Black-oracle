import type {
  CanonicalHqEventLike,
  HqDepartmentId,
  HqNavigationTarget,
  HqProjectedEvent,
  HqRoomId,
  HqSeverity,
  HqAgentStatus,
} from './contracts';

const upper = (value: unknown) => String(value ?? '').trim().toUpperCase();

const severityOf = (value: unknown): HqSeverity => {
  const normalized = upper(value);
  if (normalized === 'CRITICAL') return 'CRITICAL';
  if (normalized === 'ERROR') return 'ERROR';
  if (normalized === 'WARN' || normalized === 'WARNING') return 'WARN';
  return 'INFO';
};

const stringField = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const traceIdOf = (event: CanonicalHqEventLike) =>
  stringField(event.trace, 'traceId')
  ?? stringField(event.links, 'traceId')
  ?? stringField(event.links, 'entryTraceId');

const navigationFor = (event: CanonicalHqEventLike, traceId: string | null): HqNavigationTarget => {
  const type = upper(event.eventType);
  const tradeId = stringField(event.links, 'tradeId');

  if (traceId && ['COUNCIL', 'DECISION', 'RISK'].includes(type)) {
    return { kind: 'DECISION_REPLAY', traceId, runtimeId: event.runtimeId ?? null };
  }
  if (type === 'TRADE' || type === 'ORDER' || type === 'OUTCOME') {
    return { kind: 'TRADE', tradeId, market: event.market ?? null };
  }
  if (event.market) return { kind: 'INSTRUMENT', market: event.market };
  return { kind: 'EVENT', eventId: event.id };
};

type Placement = {
  departmentId: HqDepartmentId;
  roomId: HqRoomId;
  agentStatus: HqAgentStatus;
};

const placementFor = (event: CanonicalHqEventLike): Placement => {
  const type = upper(event.eventType);
  const name = upper(event.eventName);

  if (name.includes('RED_TEAM')) {
    return { departmentId: 'control', roomId: 'control-red-team', agentStatus: 'RED_TEAM_REVIEW' };
  }
  if (type === 'RISK' || name.includes('RISK_')) {
    return { departmentId: 'control', roomId: 'control-risk', agentStatus: 'RISK_REVIEW' };
  }
  if (type === 'COUNCIL' || name.includes('COMMITTEE') || name.includes('HEAD_COUNCIL') || name.includes('DEBATE')) {
    return { departmentId: 'executive', roomId: 'exec-investment-committee', agentStatus: 'IN_COMMITTEE' };
  }
  if (type === 'ORDER' || type === 'TRADE' || name.includes('ORDER_')) {
    return { departmentId: 'trading', roomId: 'trading-execution', agentStatus: 'EXECUTING' };
  }
  if (type === 'OUTCOME' || name.includes('OUTCOME')) {
    return { departmentId: 'control', roomId: 'control-performance', agentStatus: 'AUDITING' };
  }
  if (type === 'EVIDENCE' || name.startsWith('NARS_') || name.includes('EVIDENCE')) {
    return { departmentId: 'research', roomId: 'research-evidence-ledger', agentStatus: 'RESEARCHING' };
  }
  if (type === 'STRATEGY' || name.includes('STRATEGY') || name.includes('HORIZON_PLAN')) {
    return { departmentId: 'specialist', roomId: 'specialist-quant', agentStatus: 'RESEARCHING' };
  }
  if (type === 'EXPERIMENT' || name.includes('FACTORY') || name.includes('VALIDATION')) {
    return { departmentId: 'control', roomId: 'control-model-validation', agentStatus: 'AUDITING' };
  }
  if (name.includes('MARKET_STATE') || name.includes('SECTOR_STATE') || name.includes('UNIVERSE')) {
    return { departmentId: 'intelligence', roomId: 'intel-data-watch', agentStatus: 'COLLECTING' };
  }
  if (type === 'AI') {
    return { departmentId: 'research', roomId: 'research-synthesis', agentStatus: 'RESEARCHING' };
  }
  if (type === 'SYSTEM' && severityOf(event.severity) !== 'INFO') {
    return { departmentId: 'executive', roomId: 'exec-coo', agentStatus: severityOf(event.severity) === 'CRITICAL' ? 'ERROR' : 'BLOCKED' };
  }
  return { departmentId: 'executive', roomId: 'exec-coo', agentStatus: 'IDLE' };
};

export const projectCanonicalEventToHq = (event: CanonicalHqEventLike): HqProjectedEvent => {
  const placement = placementFor(event);
  const traceId = traceIdOf(event);
  return {
    id: `hq:${event.id}`,
    occurredAt: Number.isFinite(event.occurredAt) ? event.occurredAt : 0,
    sourceEventId: event.id,
    sourceEventType: upper(event.eventType) || 'SYSTEM',
    sourceEventName: upper(event.eventName) || 'UNKNOWN',
    severity: severityOf(event.severity),
    ...placement,
    market: event.market ?? null,
    traceId,
    summary: String(event.summary ?? event.reason ?? event.eventName ?? 'Canonical event'),
    navigation: navigationFor(event, traceId),
  };
};

export const projectCanonicalEventsToHq = (events: CanonicalHqEventLike[]) =>
  events
    .map(projectCanonicalEventToHq)
    .sort((a, b) => b.occurredAt - a.occurredAt);
