import type { PaperTradingSessionCheckpoint } from './paperSession';

export const PAPER_CHECKPOINT_LEDGER_LIMIT = 2_000;
export const PAPER_NON_QUALIFICATION_CHECKPOINT_LEDGER_LIMIT = 500;

export const paperCheckpointLedgerLimitForMode = (qualificationMode: boolean) =>
  qualificationMode
    ? PAPER_CHECKPOINT_LEDGER_LIMIT
    : PAPER_NON_QUALIFICATION_CHECKPOINT_LEDGER_LIMIT;

export const compactPaperSessionCheckpoint = (
  checkpoint: PaperTradingSessionCheckpoint,
  ledgerLimit = PAPER_CHECKPOINT_LEDGER_LIMIT,
): PaperTradingSessionCheckpoint => {
  const normalizedLedgerLimit = Number.isInteger(ledgerLimit) && ledgerLimit > 0
    ? ledgerLimit
    : PAPER_CHECKPOINT_LEDGER_LIMIT;

  return {
    ...checkpoint,
    ledger: (checkpoint.ledger ?? []).slice(-normalizedLedgerLimit).map((event) => ({
      ...event,
      payload: { ...event.payload },
    })),
  };
};
