import type { PaperTradingSessionCheckpoint } from './paperSession';

export const PAPER_CHECKPOINT_LEDGER_LIMIT = 2_000;

export const compactPaperSessionCheckpoint = (
  checkpoint: PaperTradingSessionCheckpoint,
): PaperTradingSessionCheckpoint => ({
  ...checkpoint,
  ledger: (checkpoint.ledger ?? []).slice(-PAPER_CHECKPOINT_LEDGER_LIMIT).map((event) => ({
    ...event,
    payload: { ...event.payload },
  })),
});
