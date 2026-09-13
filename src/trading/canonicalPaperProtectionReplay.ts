import { replayLongProtectionHistory, type PaperProtectionHistoryReport } from './paperProtectionHistoryReplay';
import type { TradingLedgerEvent } from './types';

export interface CanonicalPaperEventRow {
  runtime_id?: string | null;
  occurred_at?: string | number | null;
  event_name?: string | null;
  strategy_version?: string | null;
  trace?: unknown;
}

export interface CanonicalPaperProtectionReplayResult {
  runtimeId: string;
  acceptedRows: number;
  rejectedRows: number;
  rejectionReasons: Record<string, number>;
  ledger: TradingLedgerEvent[];
  report: PaperProtectionHistoryReport;
}

const SUPPORTED_LEDGER_TYPES = new Set<TradingLedgerEvent['type']>([
  'POSITION_UPDATED',
  'ORDER_FILLED',
]);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const nonNegativeInteger = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

const finiteTimestamp = (trace: Record<string, unknown>, row: CanonicalPaperEventRow): number | null => {
  const payload = asRecord(trace.payload);
  const payloadTimestamp = Number(payload?.timestamp);
  if (Number.isFinite(payloadTimestamp) && payloadTimestamp >= 0) return payloadTimestamp;

  if (typeof row.occurred_at === 'number' && Number.isFinite(row.occurred_at) && row.occurred_at >= 0) {
    return row.occurred_at;
  }
  if (typeof row.occurred_at === 'string') {
    const parsed = Date.parse(row.occurred_at);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
};

const incrementReason = (reasons: Record<string, number>, reason: string) => {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
};

/**
 * Converts read-only canonical `black_oracle_events` rows back into the minimal
 * TradingLedgerEvent stream needed by protection replay.
 *
 * The adapter is intentionally fail-closed: rows from another runtime,
 * malformed traces, and unrelated canonical events are never guessed into
 * trading ledger entries. No database/session/portfolio state is mutated.
 */
export const replayCanonicalPaperProtectionEvents = (
  runtimeId: string,
  rows: CanonicalPaperEventRow[],
): CanonicalPaperProtectionReplayResult => {
  if (!runtimeId.trim()) throw new Error('runtimeId is required.');

  const ledger: TradingLedgerEvent[] = [];
  const rejectionReasons: Record<string, number> = {};

  for (const row of rows) {
    if (row.runtime_id != null && row.runtime_id !== runtimeId) {
      incrementReason(rejectionReasons, 'RUNTIME_MISMATCH');
      continue;
    }

    const trace = asRecord(row.trace);
    if (!trace) {
      incrementReason(rejectionReasons, 'MISSING_TRACE');
      continue;
    }

    const ledgerType = typeof trace.ledgerType === 'string'
      ? trace.ledgerType.toUpperCase() as TradingLedgerEvent['type']
      : '' as TradingLedgerEvent['type'];
    if (!SUPPORTED_LEDGER_TYPES.has(ledgerType)) {
      incrementReason(rejectionReasons, 'UNSUPPORTED_LEDGER_TYPE');
      continue;
    }

    if (row.event_name != null && row.event_name !== ledgerType) {
      incrementReason(rejectionReasons, 'EVENT_NAME_MISMATCH');
      continue;
    }

    const sequence = nonNegativeInteger(trace.sequence);
    const ledgerEventId = typeof trace.ledgerEventId === 'string' && trace.ledgerEventId.trim()
      ? trace.ledgerEventId
      : null;
    const payload = asRecord(trace.payload);
    const timestamp = finiteTimestamp(trace, row);
    const strategyVersion = typeof trace.strategyVersion === 'string' && trace.strategyVersion.trim()
      ? trace.strategyVersion
      : typeof row.strategy_version === 'string' && row.strategy_version.trim()
        ? row.strategy_version
        : null;

    if (sequence == null || !ledgerEventId || !payload || timestamp == null || !strategyVersion) {
      incrementReason(rejectionReasons, 'MALFORMED_LEDGER_TRACE');
      continue;
    }

    ledger.push({
      id: ledgerEventId,
      sequence,
      timestamp,
      type: ledgerType,
      strategyVersion,
      payload: { ...payload },
    });
  }

  const acceptedRows = ledger.length;
  const rejectedRows = rows.length - acceptedRows;

  return {
    runtimeId,
    acceptedRows,
    rejectedRows,
    rejectionReasons,
    ledger,
    report: replayLongProtectionHistory(ledger),
  };
};
