import { TRADING_STRATEGY_VERSION } from './config';
import type { TradingLedgerEvent } from './types';

export class TradingLedger {
  private readonly events: TradingLedgerEvent[] = [];

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
    return this.events.slice();
  }

  latest(): TradingLedgerEvent | null {
    return this.events[this.events.length - 1] ?? null;
  }

  get size() {
    return this.events.length;
  }
}
