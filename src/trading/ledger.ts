import { TRADING_STRATEGY_VERSION } from './config';
import type { TradingLedgerEvent } from './types';

const cloneEvent = (event: TradingLedgerEvent): TradingLedgerEvent => ({
  ...event,
  payload: { ...event.payload },
});

export class TradingLedger {
  private readonly events: TradingLedgerEvent[] = [];

  static restore(events: TradingLedgerEvent[]) {
    if (!Array.isArray(events)) throw new Error('Trading ledger checkpoint must be an array.');
    const ledger = new TradingLedger();
    const ordered = events.slice().sort((a, b) => a.sequence - b.sequence);
    for (let index = 0; index < ordered.length; index += 1) {
      const event = ordered[index];
      if (!event || !event.id || !Number.isFinite(event.timestamp)) throw new Error('Trading ledger checkpoint contains an invalid event.');
      const restored = Object.freeze({
        ...cloneEvent(event),
        sequence: index + 1,
        payload: Object.freeze({ ...event.payload }),
      }) as TradingLedgerEvent;
      ledger.events.push(restored);
    }
    return ledger;
  }

  append<T extends Record<string, unknown>>(
    type: TradingLedgerEvent['type'],
    payload: T,
    strategyVersion = TRADING_STRATEGY_VERSION,
    timestamp = Date.now(),
  ): TradingLedgerEvent<T> {
    const sequence = this.events.length + 1;
    const randomId = globalThis.crypto?.randomUUID?.() ?? `${timestamp}-${sequence}-${Math.random().toString(36).slice(2)}`;
    const event = Object.freeze({
      id: randomId,
      sequence,
      timestamp,
      type,
      strategyVersion,
      payload: Object.freeze({ ...payload }),
    }) as TradingLedgerEvent<T>;

    this.events.push(event as TradingLedgerEvent);
    return event;
  }

  snapshot(): readonly TradingLedgerEvent[] {
    return this.events.map(cloneEvent);
  }

  latest(): TradingLedgerEvent | null {
    const event = this.events[this.events.length - 1];
    return event ? cloneEvent(event) : null;
  }

  get size() {
    return this.events.length;
  }
}
