import {
  replayLongProtectionCounterfactual,
  summarizeLongProtectionCounterfactuals,
  type PaperProtectionCounterfactualInput,
  type PaperProtectionCounterfactualResult,
  type PaperProtectionCounterfactualSummary,
} from './paperProtectionCounterfactual';
import type { PaperPosition, TradingLedgerEvent } from './types';
import type { LongProtectionTrigger } from './paperProtectionFill';

export interface PaperProtectionHistoryObservation extends PaperProtectionCounterfactualInput {
  ledgerEventId: string;
  ledgerSequence: number;
  timestamp: number;
  market: string;
  strategyVersion: string;
}

export interface PaperProtectionHistoryReplay {
  observation: PaperProtectionHistoryObservation;
  counterfactual: PaperProtectionCounterfactualResult;
}

export interface PaperProtectionHistoryReport {
  observations: PaperProtectionHistoryObservation[];
  replays: PaperProtectionHistoryReplay[];
  summary: PaperProtectionCounterfactualSummary;
  skippedSellFills: number;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? value as Record<string, unknown> : null;

const positiveFinite = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const nonNegativeFinite = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const positionFromPayload = (payload: Record<string, unknown>): PaperPosition | null => {
  const candidate = asRecord(payload.position);
  if (!candidate) return null;
  const market = typeof candidate.market === 'string' ? candidate.market.toUpperCase() : '';
  const quantity = positiveFinite(candidate.quantity);
  const entryPrice = positiveFinite(candidate.entryPrice);
  const averageCost = positiveFinite(candidate.averageCost);
  const openedAt = nonNegativeFinite(candidate.openedAt);
  const updatedAt = nonNegativeFinite(candidate.updatedAt);
  if (!market || quantity == null || entryPrice == null || averageCost == null || openedAt == null || updatedAt == null) return null;

  return candidate as unknown as PaperPosition;
};

const inferProtectionTrigger = (
  position: PaperPosition,
  observedPrice: number,
  partialExit: boolean,
): { trigger: LongProtectionTrigger; triggerPrice: number } | null => {
  const stop = positiveFinite(position.stopLossPrice);
  if (stop != null && observedPrice <= stop) return { trigger: 'STOP_LOSS', triggerPrice: stop };

  const tp2 = positiveFinite(position.takeProfit2Price ?? position.takeProfitPrice);
  if (tp2 != null && observedPrice >= tp2) return { trigger: 'TAKE_PROFIT_2', triggerPrice: tp2 };

  const tp1 = positiveFinite(position.takeProfit1Price);
  if (partialExit && !position.takeProfit1Taken && tp1 != null && observedPrice >= tp1) {
    return { trigger: 'TAKE_PROFIT_1', triggerPrice: tp1 };
  }

  return null;
};

/**
 * Read-only adapter over the persisted Paper session ledger.
 *
 * The adapter reconstructs the observed SELL reference from the recorded fill
 * and broker slippage, then pairs it with the latest preceding position
 * snapshot. Non-protective exits are deliberately skipped instead of being
 * retrospectively reclassified.
 *
 * No runtime/session/portfolio/ledger state is mutated by this module.
 */
export const extractLongProtectionHistoryObservations = (
  ledger: TradingLedgerEvent[],
): { observations: PaperProtectionHistoryObservation[]; skippedSellFills: number } => {
  const positions = new Map<string, PaperPosition>();
  const observations: PaperProtectionHistoryObservation[] = [];
  let skippedSellFills = 0;

  const ordered = ledger.slice().sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp);
  for (const event of ordered) {
    const payload = asRecord(event.payload) ?? {};

    if (event.type === 'POSITION_UPDATED') {
      const market = typeof payload.market === 'string' ? payload.market.toUpperCase() : '';
      const position = positionFromPayload(payload);
      if (market && position) positions.set(market, position);
      else if (market && payload.position === null) positions.delete(market);
      continue;
    }

    if (event.type !== 'ORDER_FILLED' || String(payload.side ?? '').toUpperCase() !== 'SELL') continue;

    const market = typeof payload.market === 'string' ? payload.market.toUpperCase() : '';
    const fillPrice = positiveFinite(payload.fillPrice);
    const quantity = positiveFinite(payload.quantity);
    const slippageBps = nonNegativeFinite(payload.slippageBps);
    const position = market ? positions.get(market) : null;
    if (!market || fillPrice == null || quantity == null || slippageBps == null || slippageBps >= 10_000 || !position) {
      skippedSellFills += 1;
      continue;
    }

    const observedPrice = fillPrice / (1 - slippageBps / 10_000);
    const inferred = inferProtectionTrigger(position, observedPrice, payload.partialExit === true);
    if (!inferred) {
      skippedSellFills += 1;
      continue;
    }

    observations.push({
      ledgerEventId: event.id,
      ledgerSequence: event.sequence,
      timestamp: event.timestamp,
      market,
      strategyVersion: event.strategyVersion,
      trigger: inferred.trigger,
      triggerPrice: inferred.triggerPrice,
      observedPrice,
      quantity,
      sellSlippageBps: slippageBps,
    });
  }

  return { observations, skippedSellFills };
};

export const replayLongProtectionHistory = (
  ledger: TradingLedgerEvent[],
): PaperProtectionHistoryReport => {
  const extracted = extractLongProtectionHistoryObservations(ledger);
  const replays = extracted.observations.map((observation) => ({
    observation,
    counterfactual: replayLongProtectionCounterfactual(observation),
  }));

  return {
    observations: extracted.observations,
    replays,
    summary: summarizeLongProtectionCounterfactuals(extracted.observations),
    skippedSellFills: extracted.skippedSellFills,
  };
};
