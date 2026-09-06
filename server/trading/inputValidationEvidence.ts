import type { SupportedUpbitMinuteUnit } from '../../src/trading/config';
import type { Candle } from '../../src/trading/types';
import { buildInputValidationRecord, type InputValidationLedgerRecord, type InputValidationPolicy } from '../../src/trading/validationDataset';
import { getMinuteCandleHistory } from './upbitPublic';

export const REQUIRED_PROMOTION_TIMEFRAMES = [15, 60, 240] as const satisfies readonly SupportedUpbitMinuteUnit[];
export type RequiredPromotionTimeframe = typeof REQUIRED_PROMOTION_TIMEFRAMES[number];

export type HistoricalCandleReader = (
  market: string,
  unit: SupportedUpbitMinuteUnit,
  count: number,
  options?: { to?: string },
) => Promise<Candle[]>;

export interface MarketInputValidationEvidence {
  schemaVersion: 1;
  market: string;
  generatedAt: number;
  requestedCandlesPerTimeframe: number;
  requiredTimeframes: RequiredPromotionTimeframe[];
  records: InputValidationLedgerRecord[];
  disposition: 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';
  reasons: string[];
  promotionAuthority: false;
  executionAuthority: false;
}

export interface StrategyInputValidationEvidence {
  schemaVersion: 1;
  generatedAt: number;
  markets: string[];
  requiredTimeframes: RequiredPromotionTimeframe[];
  requestedCandlesPerTimeframe: number;
  marketEvidence: MarketInputValidationEvidence[];
  records: InputValidationLedgerRecord[];
  disposition: MarketInputValidationEvidence['disposition'];
  reasons: string[];
  promotionAuthority: false;
  executionAuthority: false;
}

const overallDisposition = (records: InputValidationLedgerRecord[], expectedRecords: number): MarketInputValidationEvidence['disposition'] => {
  if (records.some((record) => record.disposition === 'REJECT')) return 'REJECT';
  if (records.some((record) => record.disposition === 'INSUFFICIENT_DATA')) return 'INSUFFICIENT_DATA';
  if (records.some((record) => record.disposition === 'WATCH')) return 'WATCH';
  return records.length === expectedRecords ? 'PASS' : 'INSUFFICIENT_DATA';
};

const normalizeMarket = (market: unknown) => {
  const normalized = String(market ?? '').toUpperCase();
  if (!/^KRW-[A-Z0-9]+$/.test(normalized)) throw new Error(`Invalid input-validation market: ${normalized}`);
  return normalized;
};

/**
 * Build reproducible input-validation evidence for every timeframe used by the
 * current crypto strategy. This is a research/promotion evidence primitive only;
 * it does not mutate the live PAPER polling path or place orders.
 */
export const buildMarketInputValidationEvidence = async (
  market: string,
  options: {
    evaluationCutoff?: number;
    candlesPerTimeframe?: number;
    policy?: InputValidationPolicy;
    reader?: HistoricalCandleReader;
  } = {},
): Promise<MarketInputValidationEvidence> => {
  const normalized = normalizeMarket(market);
  const evaluationCutoff = options.evaluationCutoff ?? Date.now();
  if (!Number.isFinite(evaluationCutoff) || evaluationCutoff <= 0) throw new Error('Input-validation evaluationCutoff must be positive and finite.');
  const candlesPerTimeframe = Math.max(400, Math.min(1_000, Math.trunc(options.candlesPerTimeframe ?? 400)));
  const reader = options.reader ?? getMinuteCandleHistory;

  const records = await Promise.all(REQUIRED_PROMOTION_TIMEFRAMES.map(async (unit) => {
    const candles = await reader(normalized, unit, candlesPerTimeframe);
    return buildInputValidationRecord(candles, evaluationCutoff, {
      ...options.policy,
      minWarmupCandles: Math.max(400, options.policy?.minWarmupCandles ?? 400),
      warmupWindows: options.policy?.warmupWindows ?? [200, 250, 300, 400],
      policyVersion: options.policy?.policyVersion ?? 'S7_MULTI_TIMEFRAME_INPUT_VALIDATION_V1',
    });
  }));

  const disposition = overallDisposition(records, REQUIRED_PROMOTION_TIMEFRAMES.length);
  const reasons = records.map((record) => `${record.dataset.timeframeMinutes ?? 'unknown'}m=${record.disposition} (${record.dataset.datasetId}).`);
  if (records.some((record) => !REQUIRED_PROMOTION_TIMEFRAMES.includes(record.dataset.timeframeMinutes as RequiredPromotionTimeframe))) {
    reasons.push('At least one returned dataset does not match a required promotion timeframe.');
  }

  return {
    schemaVersion: 1,
    market: normalized,
    generatedAt: evaluationCutoff,
    requestedCandlesPerTimeframe: candlesPerTimeframe,
    requiredTimeframes: [...REQUIRED_PROMOTION_TIMEFRAMES],
    records,
    disposition,
    reasons,
    promotionAuthority: false,
    executionAuthority: false,
  };
};

/**
 * Orchestrate promotion input validation across every market represented by the
 * strategy evidence. The same evaluation cutoff and policy are held constant across
 * markets so resulting checksums can be audited as one validation run.
 */
export const buildStrategyInputValidationEvidence = async (
  markets: string[],
  options: {
    evaluationCutoff?: number;
    candlesPerTimeframe?: number;
    policy?: InputValidationPolicy;
    reader?: HistoricalCandleReader;
    maxMarkets?: number;
  } = {},
): Promise<StrategyInputValidationEvidence> => {
  const normalizedMarkets = [...new Set((markets ?? []).map(normalizeMarket))].sort();
  const maxMarkets = Math.max(1, Math.min(12, Math.trunc(options.maxMarkets ?? 12)));
  if (!normalizedMarkets.length) throw new Error('Strategy input validation requires at least one market.');
  if (normalizedMarkets.length > maxMarkets) throw new Error(`Strategy input validation is limited to ${maxMarkets} market(s) per bounded run.`);
  const evaluationCutoff = options.evaluationCutoff ?? Date.now();
  const marketEvidence = await Promise.all(normalizedMarkets.map((market) => buildMarketInputValidationEvidence(market, {
    evaluationCutoff,
    candlesPerTimeframe: options.candlesPerTimeframe,
    policy: options.policy,
    reader: options.reader,
  })));
  const records = marketEvidence.flatMap((evidence) => evidence.records);
  const expectedRecords = normalizedMarkets.length * REQUIRED_PROMOTION_TIMEFRAMES.length;
  const disposition = overallDisposition(records, expectedRecords);

  return {
    schemaVersion: 1,
    generatedAt: evaluationCutoff,
    markets: normalizedMarkets,
    requiredTimeframes: [...REQUIRED_PROMOTION_TIMEFRAMES],
    requestedCandlesPerTimeframe: marketEvidence[0]?.requestedCandlesPerTimeframe ?? Math.max(400, Math.min(1_000, Math.trunc(options.candlesPerTimeframe ?? 400))),
    marketEvidence,
    records,
    disposition,
    reasons: marketEvidence.map((evidence) => `${evidence.market}: ${evidence.disposition}.`),
    promotionAuthority: false,
    executionAuthority: false,
  };
};
