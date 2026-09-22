export const CANONICAL_ORDER_INTENT_VERSION = 'bot.canonical-order-intent.v1' as const;

export type CanonicalOrderSide = 'BUY' | 'SELL';

export interface CanonicalOrderIntent {
  contractVersion: typeof CANONICAL_ORDER_INTENT_VERSION;
  intentId: string;
  market: string;
  side: CanonicalOrderSide;
  quantity: number;
  referencePrice: number;
  strategyId: string;
  strategyRevision: string;
  observedAt: string;
  maxAgeMs: number;
}

export const isNonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isFinitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

export function canonicalOrderIntentFingerprint(intent: CanonicalOrderIntent): string {
  const payload = [
    intent.contractVersion, intent.intentId, intent.market, intent.side,
    String(intent.quantity), String(intent.referencePrice), intent.strategyId,
    intent.strategyRevision, intent.observedAt, String(intent.maxAgeMs),
  ].join('|');
  let hash = 2166136261;
  for (const ch of payload) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `order-intent-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
