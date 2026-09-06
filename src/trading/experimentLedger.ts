import type {
  ExperimentQualificationBinding,
  ExperimentResult,
  ExperimentRun,
  ExperimentSpec,
  ExperimentStatus,
} from './experiment';
import { normalizeExperimentSpec } from './experiment';

export type ExperimentLedgerEventType =
  | 'EXPERIMENT_PLANNED'
  | 'EXPERIMENT_STARTED'
  | 'EXPERIMENT_COMPLETED';

export interface ExperimentLedgerEvent {
  id: string;
  sequence: number;
  timestamp: number;
  type: ExperimentLedgerEventType;
  experimentId: string;
  payload: Readonly<Record<string, unknown>>;
}

const clone = (event: ExperimentLedgerEvent): ExperimentLedgerEvent => ({
  ...event,
  payload: { ...event.payload },
});

const makeId = (timestamp: number, sequence: number) =>
  globalThis.crypto?.randomUUID?.() ?? `experiment-ledger-${timestamp}-${sequence}`;

export class ExperimentLedger {
  private readonly events: ExperimentLedgerEvent[] = [];

  static restore(events: ExperimentLedgerEvent[]) {
    if (!Array.isArray(events)) throw new Error('Experiment ledger checkpoint must be an array.');
    const ledger = new ExperimentLedger();
    const ordered = events.slice().sort((a, b) => a.sequence - b.sequence);
    for (let index = 0; index < ordered.length; index += 1) {
      const event = ordered[index];
      if (!event?.id || !event.experimentId || !Number.isFinite(event.timestamp)) throw new Error('Experiment ledger contains an invalid event.');
      ledger.events.push(Object.freeze({
        ...clone(event),
        sequence: index + 1,
        payload: Object.freeze({ ...event.payload }),
      }));
    }
    return ledger;
  }

  plan(spec: ExperimentSpec, timestamp = Date.now()) {
    const normalized = normalizeExperimentSpec(spec);
    if (normalized.qualification && timestamp < normalized.qualification.windowStartedAt) {
      throw new Error('Qualified experiment cannot be planned before its qualification window starts.');
    }
    return this.append('EXPERIMENT_PLANNED', normalized.id, { spec: normalized }, timestamp);
  }

  start(run: ExperimentRun, timestamp = Date.now()) {
    if (!run.id.trim() || !run.experimentId.trim()) throw new Error('Experiment run ids are required.');
    if (run.status !== 'RUNNING') throw new Error('Experiment run must start with RUNNING status.');
    const lineage = this.lineageFor(run.experimentId);
    if (lineage.qualification && run.startedAt < lineage.qualification.windowStartedAt) {
      throw new Error('Qualified experiment run cannot start before its qualification window.');
    }
    return this.append('EXPERIMENT_STARTED', run.experimentId, {
      run: Object.freeze({ ...run }),
      qualification: lineage.qualification ? Object.freeze({ ...lineage.qualification }) : null,
      researchConfigurationId: lineage.researchConfigurationId,
    }, timestamp);
  }

  complete(result: ExperimentResult, timestamp = Date.now()) {
    if (!['PASSED', 'REJECTED', 'INVALID'].includes(result.status)) throw new Error('Experiment result status is invalid.');
    const lineage = this.lineageFor(result.experimentId);
    if (lineage.qualification && result.finishedAt < lineage.qualification.windowStartedAt) {
      throw new Error('Qualified experiment result cannot finish before its qualification window.');
    }
    return this.append('EXPERIMENT_COMPLETED', result.experimentId, {
      result: Object.freeze({ ...result }),
      qualification: lineage.qualification ? Object.freeze({ ...lineage.qualification }) : null,
      researchConfigurationId: lineage.researchConfigurationId,
    }, timestamp);
  }

  status(experimentId: string): ExperimentStatus | null {
    const matching = this.events.filter((event) => event.experimentId === experimentId);
    if (!matching.length) return null;
    const latest = matching[matching.length - 1];
    if (latest.type === 'EXPERIMENT_PLANNED') return 'PLANNED';
    if (latest.type === 'EXPERIMENT_STARTED') return 'RUNNING';
    const result = latest.payload.result as ExperimentResult | undefined;
    return result?.status ?? 'INVALID';
  }

  snapshot(): readonly ExperimentLedgerEvent[] {
    return this.events.map(clone);
  }

  private lineageFor(experimentId: string): {
    qualification: ExperimentQualificationBinding | null;
    researchConfigurationId: string | null;
  } {
    const planned = this.events
      .filter((event) => event.experimentId === experimentId && event.type === 'EXPERIMENT_PLANNED')
      .at(-1);
    const spec = planned?.payload.spec as ExperimentSpec | undefined;
    return {
      qualification: spec?.qualification ? { ...spec.qualification } : null,
      researchConfigurationId: spec?.researchConfigurationId ?? null,
    };
  }

  private append(
    type: ExperimentLedgerEventType,
    experimentId: string,
    payload: Record<string, unknown>,
    timestamp: number,
  ) {
    if (!experimentId.trim()) throw new Error('Experiment id is required.');
    if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('Experiment ledger timestamp is invalid.');
    const sequence = this.events.length + 1;
    const event = Object.freeze({
      id: makeId(timestamp, sequence),
      sequence,
      timestamp,
      type,
      experimentId: experimentId.trim(),
      payload: Object.freeze({ ...payload }),
    }) as ExperimentLedgerEvent;
    this.events.push(event);
    return clone(event);
  }
}
