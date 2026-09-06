import {
  bindExperimentSpecToQualification,
  type ExperimentQualificationBinding,
  type ExperimentResult,
  type ExperimentRun,
  type ExperimentSpec,
} from '../../src/trading/experiment';
import { ExperimentLedger, type ExperimentLedgerEvent } from '../../src/trading/experimentLedger';
import type { QualificationWindowCheckpoint } from '../../src/trading/qualificationWindow';
import { bindExperimentSpecToStrategyGenome } from '../../src/trading/researchConfiguration';
import type { StrategyGenome } from '../../src/trading/strategyGenome';

export interface RuntimeExperimentLedgerSummary {
  events: number;
  experiments: number;
  planned: number;
  started: number;
  completed: number;
}

const bindingFromQualificationWindow = (
  window: QualificationWindowCheckpoint | null | undefined,
): ExperimentQualificationBinding => {
  if (!window || window.status !== 'COLLECTING' || !Number.isFinite(window.startedAt) || (window.startedAt ?? 0) <= 0) {
    throw new Error('Strategy-bound qualification experiment requires an active COLLECTING qualification window.');
  }
  return {
    windowId: window.id,
    sourceRevision: window.sourceRevision,
    windowStartedAt: window.startedAt as number,
  };
};

class RuntimeExperimentLedgerStore {
  private ledger = new ExperimentLedger();

  restore(events: ExperimentLedgerEvent[] | readonly ExperimentLedgerEvent[] | null | undefined) {
    this.ledger = ExperimentLedger.restore(Array.isArray(events) ? [...events] : []);
    return this.summary();
  }

  snapshot(): ExperimentLedgerEvent[] {
    return this.ledger.snapshot().map((event) => ({ ...event, payload: { ...event.payload } }));
  }

  plan(spec: ExperimentSpec, timestamp = Date.now()) {
    return this.ledger.plan(spec, timestamp);
  }

  planForStrategyGenome(spec: ExperimentSpec, genome: StrategyGenome, timestamp = Date.now()) {
    return this.ledger.plan(bindExperimentSpecToStrategyGenome(spec, genome), timestamp);
  }

  planForQualifiedStrategyGenome(
    spec: ExperimentSpec,
    genome: StrategyGenome,
    window: QualificationWindowCheckpoint,
    timestamp = Date.now(),
  ) {
    const binding = bindingFromQualificationWindow(window);
    if (timestamp < binding.windowStartedAt) {
      throw new Error('Qualified strategy experiment cannot be planned before the qualification window starts.');
    }
    const strategyBound = bindExperimentSpecToStrategyGenome(spec, genome);
    return this.ledger.plan(bindExperimentSpecToQualification(strategyBound, binding), timestamp);
  }

  start(run: ExperimentRun, timestamp = Date.now()) {
    return this.ledger.start(run, timestamp);
  }

  complete(result: ExperimentResult, timestamp = Date.now()) {
    return this.ledger.complete(result, timestamp);
  }

  summary(): RuntimeExperimentLedgerSummary {
    const events = this.ledger.snapshot();
    const experimentIds = new Set(events.map((event) => event.experimentId));
    return {
      events: events.length,
      experiments: experimentIds.size,
      planned: events.filter((event) => event.type === 'EXPERIMENT_PLANNED').length,
      started: events.filter((event) => event.type === 'EXPERIMENT_STARTED').length,
      completed: events.filter((event) => event.type === 'EXPERIMENT_COMPLETED').length,
    };
  }
}

export const runtimeExperimentLedgerStore = new RuntimeExperimentLedgerStore();
