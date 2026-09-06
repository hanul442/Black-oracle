import type { Candle } from './types';

export type ValidationIntegrityDisposition = 'PASS' | 'WATCH' | 'REJECT';
export type ValidationIntegrityIssueCode =
  | 'EMPTY_SERIES'
  | 'INSUFFICIENT_WARMUP'
  | 'INVALID_TIMESTAMP'
  | 'LOOKAHEAD_CANDLE'
  | 'NON_MONOTONIC_TIMESTAMP'
  | 'DUPLICATE_TIMESTAMP'
  | 'MIXED_MARKET'
  | 'MIXED_TIMEFRAME'
  | 'INVALID_OHLC'
  | 'INVALID_VOLUME'
  | 'UNEXPECTED_GAP';

export interface ValidationIntegrityIssue {
  code: ValidationIntegrityIssueCode;
  severity: 'BLOCK' | 'WARN';
  message: string;
  candleIndex?: number;
  timestamp?: number;
}

export interface CandleIntegrityOptions {
  /** Evaluation cut-off. Any candle strictly after this timestamp is future information. */
  asOf: number;
  /** Current indicator stack requires at least 200 observations. */
  minWarmupCandles?: number;
  /** Gap warnings are emitted when an interval exceeds expected spacing by this factor. */
  maxGapFactor?: number;
}

export interface CandleIntegrityResult {
  disposition: ValidationIntegrityDisposition;
  sampleCount: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
  market: string | null;
  timeframeMinutes: number | null;
  issues: ValidationIntegrityIssue[];
  provenance: {
    evaluationCutoffEnforced: true;
    futureCandlesBlocked: true;
    chronologyCheckedOnSuppliedOrder: true;
    duplicateTimestampsBlocked: true;
    ohlcChecked: true;
    warmupChecked: true;
  };
}

const finitePositive = (value: number) => Number.isFinite(value) && value > 0;

export const assessCandleIntegrity = (
  candles: Candle[],
  options: CandleIntegrityOptions,
): CandleIntegrityResult => {
  const minWarmupCandles = Math.max(1, Math.trunc(options.minWarmupCandles ?? 200));
  const maxGapFactor = Math.max(1, options.maxGapFactor ?? 1.5);
  const issues: ValidationIntegrityIssue[] = [];
  const source = Array.isArray(candles) ? candles : [];

  if (!Number.isFinite(options.asOf) || options.asOf <= 0) {
    throw new Error('Candle integrity asOf must be a positive finite timestamp.');
  }

  if (source.length === 0) {
    issues.push({ code: 'EMPTY_SERIES', severity: 'BLOCK', message: 'No candles were supplied for evaluation.' });
  }
  if (source.length < minWarmupCandles) {
    issues.push({
      code: 'INSUFFICIENT_WARMUP',
      severity: 'BLOCK',
      message: `Strategy evaluation requires at least ${minWarmupCandles} candles; received ${source.length}.`,
    });
  }

  const expectedMarket = source[0]?.market ?? null;
  const expectedTimeframe = source[0]?.timeframeMinutes ?? null;
  const expectedSpacingMs = expectedTimeframe && expectedTimeframe > 0 ? expectedTimeframe * 60_000 : null;
  const seenTimestamps = new Set<number>();

  for (let index = 0; index < source.length; index += 1) {
    const candle = source[index];
    const previous = index > 0 ? source[index - 1] : null;

    if (candle.market !== expectedMarket) {
      issues.push({
        code: 'MIXED_MARKET', severity: 'BLOCK', candleIndex: index, timestamp: candle.timestamp,
        message: `Mixed market series detected: expected ${expectedMarket}, received ${candle.market}.`,
      });
    }
    if (candle.timeframeMinutes !== expectedTimeframe || !Number.isFinite(candle.timeframeMinutes) || candle.timeframeMinutes <= 0) {
      issues.push({
        code: 'MIXED_TIMEFRAME', severity: 'BLOCK', candleIndex: index, timestamp: candle.timestamp,
        message: `Mixed or invalid timeframe detected at candle ${index}.`,
      });
    }
    if (!Number.isFinite(candle.timestamp) || candle.timestamp <= 0) {
      issues.push({
        code: 'INVALID_TIMESTAMP', severity: 'BLOCK', candleIndex: index, timestamp: candle.timestamp,
        message: `Candle timestamp ${candle.timestamp} is not a positive finite timestamp.`,
      });
    } else if (candle.timestamp > options.asOf) {
      issues.push({
        code: 'LOOKAHEAD_CANDLE', severity: 'BLOCK', candleIndex: index, timestamp: candle.timestamp,
        message: `Candle timestamp ${candle.timestamp} is later than evaluation cut-off ${options.asOf}.`,
      });
    }
    if (seenTimestamps.has(candle.timestamp)) {
      issues.push({
        code: 'DUPLICATE_TIMESTAMP', severity: 'BLOCK', candleIndex: index, timestamp: candle.timestamp,
        message: `Duplicate candle timestamp ${candle.timestamp} detected.`,
      });
    }
    seenTimestamps.add(candle.timestamp);

    if (previous && candle.timestamp <= previous.timestamp) {
      issues.push({
        code: 'NON_MONOTONIC_TIMESTAMP', severity: 'BLOCK', candleIndex: index, timestamp: candle.timestamp,
        message: 'Input to strategy evaluation must be strictly increasing; the integrity gate never silently reorders supplied candles.',
      });
    }

    const validOhlc = [candle.open, candle.high, candle.low, candle.close].every(finitePositive)
      && candle.high >= Math.max(candle.open, candle.close, candle.low)
      && candle.low <= Math.min(candle.open, candle.close, candle.high);
    if (!validOhlc) {
      issues.push({
        code: 'INVALID_OHLC', severity: 'BLOCK', candleIndex: index, timestamp: candle.timestamp,
        message: 'Candle OHLC values are non-finite, non-positive, or violate high/low bounds.',
      });
    }
    if (!Number.isFinite(candle.volume) || candle.volume < 0 || (candle.quoteVolume != null && (!Number.isFinite(candle.quoteVolume) || candle.quoteVolume < 0))) {
      issues.push({
        code: 'INVALID_VOLUME', severity: 'BLOCK', candleIndex: index, timestamp: candle.timestamp,
        message: 'Candle volume or quote volume is invalid.',
      });
    }

    if (previous && expectedSpacingMs && candle.timestamp > previous.timestamp) {
      const gap = candle.timestamp - previous.timestamp;
      if (gap > expectedSpacingMs * maxGapFactor) {
        issues.push({
          code: 'UNEXPECTED_GAP', severity: 'WARN', candleIndex: index, timestamp: candle.timestamp,
          message: `Observed candle gap ${gap}ms exceeds expected ${expectedSpacingMs}ms spacing by more than ${maxGapFactor}x.`,
        });
      }
    }
  }

  const hasBlocker = issues.some((issue) => issue.severity === 'BLOCK');
  const hasWarning = issues.some((issue) => issue.severity === 'WARN');
  return {
    disposition: hasBlocker ? 'REJECT' : hasWarning ? 'WATCH' : 'PASS',
    sampleCount: source.length,
    firstTimestamp: source[0]?.timestamp ?? null,
    lastTimestamp: source[source.length - 1]?.timestamp ?? null,
    market: expectedMarket,
    timeframeMinutes: expectedTimeframe,
    issues,
    provenance: {
      evaluationCutoffEnforced: true,
      futureCandlesBlocked: true,
      chronologyCheckedOnSuppliedOrder: true,
      duplicateTimestampsBlocked: true,
      ohlcChecked: true,
      warmupChecked: true,
    },
  };
};

export const assertCandleIntegrity = (candles: Candle[], options: CandleIntegrityOptions): CandleIntegrityResult => {
  const result = assessCandleIntegrity(candles, options);
  if (result.disposition === 'REJECT') {
    const blockers = result.issues.filter((issue) => issue.severity === 'BLOCK').map((issue) => issue.code);
    throw new Error(`Candle integrity rejected strategy input: ${[...new Set(blockers)].join(', ')}`);
  }
  return result;
};
