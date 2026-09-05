export type OperatorEventType =
  | 'CYCLE'
  | 'DECISION'
  | 'EVIDENCE_TRANSITION'
  | 'RISK'
  | 'TRADE'
  | 'SYSTEM'
  | 'INCIDENT';

export type OperatorEventSeverity = 'INFO' | 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface OperatorEventRefs {
  tradeCaseId?: string | null;
  evidenceIds?: string[];
  councilRunId?: string | null;
  intelligencePackageId?: string | null;
  executionId?: string | null;
}

export interface OperatorEventRecord {
  eventId: string;
  runtimeId: string;
  occurredAt: number;
  type: OperatorEventType;
  severity: OperatorEventSeverity;
  cycleNumber?: number | null;
  market?: string | null;
  stateKey?: string | null;
  dedupeKey?: string | null;
  refs: OperatorEventRefs;
  payload: Record<string, unknown>;
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`);
  return `{${entries.join(',')}}`;
};

const fnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const buildOperatorEventId = (input: Omit<OperatorEventRecord, 'eventId'>) => {
  const canonical = stableStringify({
    runtimeId: input.runtimeId,
    occurredAt: input.occurredAt,
    type: input.type,
    cycleNumber: input.cycleNumber ?? null,
    market: input.market ?? null,
    stateKey: input.stateKey ?? null,
    refs: input.refs,
    payload: input.payload,
  });
  return `boe-${input.type.toLowerCase()}-${fnv1a(canonical)}`;
};

export const buildOperatorEvent = (input: Omit<OperatorEventRecord, 'eventId'>): OperatorEventRecord => ({
  ...input,
  eventId: buildOperatorEventId(input),
  refs: {
    ...input.refs,
    evidenceIds: input.refs.evidenceIds ? [...input.refs.evidenceIds].sort() : [],
  },
});

export const shouldEmitStateTransition = (previousStateKey: string | null | undefined, nextStateKey: string | null | undefined) =>
  Boolean(nextStateKey) && previousStateKey !== nextStateKey;
