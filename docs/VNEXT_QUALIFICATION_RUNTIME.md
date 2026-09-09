# BLACK ORACLE vNext Qualification Runtime

## Runtime identity

The qualification runtime is isolated from the historical Paper account.

- runtime: `black-oracle-paper-vnext`
- Railway service: `black-oracle-paper-vnext`
- qualification id: `paper-100m-20260909-s1r1`
- qualification armed at: `2026-09-09T11:15:49.000Z`
- pinned system revision: `fdca8ad13daf9cf71a775a80e93116ae8c96c81d`
- strategy version: `BO-UNIFIED-v0.2.0`
- risk config hash: `0f6ae8c3cb3d6d93`
- initial capital: `KRW 100,000,000`
- authority: PAPER only
- live trading: disabled

The historical `black-oracle-paper` runtime is retained independently. It is never reset, scaled, migrated, or retired automatically merely because vNext exists.

## Bootstrap invariant

The first authorized scheduler request creates a checkpoint only. It must not execute a Paper cycle.

The activation gate requires the exact pinned runtime identity above plus:

- reason = `qualification-runtime-initialized`
- initial equity = KRW 100,000,000
- cash = KRW 100,000,000
- positions = 0
- closed trades = 0
- trading ledger events = 0
- runtime evidence = 0
- cycle count = 0
- last cycle = JSON null
- loop running = false

`ops/supabase/activate-vnext-qualification-runtime.sql` refuses scheduler activation if any identity or pristine invariant is violated. It also refuses to overwrite an existing vNext cron job.

## Checkpoint policy

The Supabase runtime checkpoint is an operational recovery snapshot, not the long-term audit ledger. Durable historical observability belongs in the Canonical Event Ledger.

To keep PostgREST writes below the Production request timeout, the Paper checkpoint stores only the newest 2,000 trading-ledger events. Restore applies the same bound. Portfolio state, positions, closed trades, evidence, loop state, and risk/qualification identity remain intact.

## Qualification mutation rule

A qualification checkpoint is fail-closed when any pinned identity changes:

- runtime id
- qualification id
- armed timestamp
- system revision
- strategy version
- risk configuration hash
- initial equity

A code/risk/strategy change therefore requires an explicit qualification restart rather than silently contaminating the current sample. S1R1 is the explicit restart after the checkpoint-compaction fix; the earlier S1 bootstrap contained zero positions, zero closed trades, zero ledger events, zero evidence, and zero completed cycles before it was conditionally removed.

## Scheduler topology

```text
pg_cron (15m)
  -> Supabase black-oracle-paper-scheduler
     -> runtime-specific config/auth row
        -> exact approved Railway service
           -> /api/trading-paper-cycle
              -> lease
              -> restore + identity gate
              -> Paper cycle
              -> compact recovery checkpoint
              -> advisory AI / Canonical Event Ledger
```

The legacy and vNext schedulers use separate runtime ids and separate checkpoint rows. No Production code path is allowed to promote vNext to live execution authority.
