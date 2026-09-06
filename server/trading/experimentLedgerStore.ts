import type { ExperimentResult, ExperimentRun, ExperimentSpec } from '../../src/trading/experiment';
import { ExperimentLedger, type ExperimentLedgerEvent } from '../../src/trading/experimentLedger';
import { bindExperimentSpecToStrategyGenome } from '../../src/trading/researchConfiguration';
import type { StrategyGenome } from '../../src/trading/strategyGenome';

export interface RuntimeExperimentLedgerSummary {
  events: number;
  experiments: number;
  planned: number;
  started: number;
  completed: number;
}

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
