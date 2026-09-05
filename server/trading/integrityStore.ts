import {
  appendIntegrityEvent,
  buildIncidentOpenedEvent,
  buildIncidentTransitionEvent,
  createIntegrityLedgerCheckpoint,
  deriveIntegrityIncidents,
  normalizeIntegrityLedgerCheckpoint,
  summarizeIntegrityLedger,
  type IntegrityIncidentKind,
  type IntegrityIncidentSnapshot,
  type IntegrityLedgerCheckpoint,
  type IntegritySeverity,
} from '../../src/trading/integrityLedger';
import type { PaperLoopCycleResult } from './paperLoop';

const dayKey = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

export class RuntimeIntegrityStore {
  private checkpoint: IntegrityLedgerCheckpoint | null = null;

  ensureStarted(timestamp = Date.now()) {
    if (!this.checkpoint) this.checkpoint = createIntegrityLedgerCheckpoint(timestamp);
    return this.snapshot();
  }

  restore(value: unknown) {
    this.checkpoint = normalizeIntegrityLedgerCheckpoint(value);
    return this.snapshot();
  }

  snapshot() {
    return this.checkpoint
      ? { schemaVersion: 1 as const, startedAt: this.checkpoint.startedAt, events: this.checkpoint.events.map((item) => ({ ...item })) }
      : null;
  }

  summary(now = Date.now(), requiredCoverageDays = 14) {
    return summarizeIntegrityLedger(this.checkpoint, now, requiredCoverageDays);
  }

  incidents(): IntegrityIncidentSnapshot[] {
    return deriveIntegrityIncidents(this.checkpoint);
  }

  private hasDedupeKey(dedupeKey: string) {
    return Boolean(this.checkpoint?.events.some((event) => event.type === 'INCIDENT_OPENED' && event.dedupeKey === dedupeKey));
  }

  openIncident(input: {
    kind: IntegrityIncidentKind;
    severity: IntegritySeverity;
    dedupeKey: string;
    message: string;
    timestamp?: number;
    market?: string | null;
    cycleNumber?: number | null;
    actor?: string | null;
  }) {
    const timestamp = input.timestamp ?? Date.now();
    this.ensureStarted(timestamp);
    if (this.hasDedupeKey(input.dedupeKey)) {
      return this.incidents().find((item) => item.dedupeKey === input.dedupeKey) ?? null;
    }
    this.checkpoint = appendIntegrityEvent(this.checkpoint!, buildIncidentOpenedEvent({ ...input, timestamp }));
    return this.incidents().find((item) => item.dedupeKey === input.dedupeKey) ?? null;
  }

  transition(incidentId: string, type: 'INCIDENT_ACKNOWLEDGED' | 'INCIDENT_RESOLVED', actor: string, note?: string | null) {
    this.ensureStarted();
    const incident = this.incidents().find((item) => item.incidentId === incidentId);
    if (!incident) throw new Error('Integrity incident was not found.');
    this.checkpoint = appendIntegrityEvent(this.checkpoint!, buildIncidentTransitionEvent({ incident, type, actor, note }));
    return this.incidents().find((item) => item.incidentId === incidentId)!;
  }

  inspectCycle(cycle: PaperLoopCycleResult, cycleNumber: number) {
    this.ensureStarted(cycle.finishedAt || Date.now());
    for (const trace of cycle.markets) {
      const riskReasons = Array.isArray(trace.riskReasons) ? trace.riskReasons : [];
      const dailyLossReached = riskReasons.some((reason) => /Daily loss limit/i.test(reason));
      if (dailyLossReached) {
        this.openIncident({
          kind: 'DAILY_RISK_BREACH',
          severity: 'WARNING',
          dedupeKey: `daily-risk-breach:${dayKey(trace.timestamp || cycle.finishedAt)}`,
          message: 'Daily loss circuit-breaker threshold was reached; new risk-taking must remain blocked.',
          timestamp: trace.timestamp || cycle.finishedAt,
          market: trace.market,
          cycleNumber,
        });
      }

      if (trace.action === 'ENTER' && trace.riskDisposition !== 'APPROVE') {
        this.openIncident({
          kind: 'RISK_BYPASS',
          severity: 'CRITICAL',
          dedupeKey: `risk-bypass:${trace.market}:${trace.timestamp}`,
          message: `ENTER executed without deterministic risk approval (${trace.riskDisposition}).`,
          timestamp: trace.timestamp,
          market: trace.market,
          cycleNumber,
        });
      }

      const integrityFault = riskReasons.some((reason) => /Market data is stale|Market feed is disconnected|ledger is not reconciled|Duplicate order fingerprint/i.test(reason));
      if (trace.action === 'ENTER' && integrityFault) {
        this.openIncident({
          kind: 'EXECUTION_INTEGRITY',
          severity: 'CRITICAL',
          dedupeKey: `execution-integrity:${trace.market}:${trace.timestamp}`,
          message: 'ENTER occurred while a stale-feed, duplicate-order, or ledger-integrity fault was present.',
          timestamp: trace.timestamp,
          market: trace.market,
          cycleNumber,
        });
      }
    }
    return this.summary(cycle.finishedAt || Date.now());
  }
}

export const runtimeIntegrityStore = new RuntimeIntegrityStore();
