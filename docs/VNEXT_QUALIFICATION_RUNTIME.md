# BLACK ORACLE vNext Qualification Runtime

## Runtime identity

The first qualification runtime is isolated from the historical Paper account.

- runtime: `black-oracle-paper-vnext`
- Railway service: `black-oracle-paper-vnext`
- qualification id: `paper-100m-20260909-s1`
- initial capital: `KRW 100,000,000`
- authority: PAPER only
- live trading: disabled
- pinned system revision: established in the runtime checkpoint and Railway environment

The historical `black-oracle-paper` runtime is retained independently. It is never reset, scaled, migrated, or retired automatically merely because vNext exists.

## Bootstrap invariant

The first authorized scheduler request creates a checkpoint only. It must not execute a Paper cycle.

The activation gate requires:

- reason = `qualification-runtime-initialized`
- initial equity = KRW 100,000,000
- cash = KRW 100,000,000
- positions = 0
- closed trades = 0
- cycle count = 0
- last cycle = null

`ops/supabase/activate-vnext-qualification-runtime.sql` refuses scheduler activation if any invariant is already violated.

## Checkpoint policy

The Supabase runtime checkpoint is an operational recovery snapshot, not the long-term audit ledger. Durable historical observability belongs in the Canonical Event Ledger.

To keep PostgREST writes below the production request timeout, the Paper checkpoint stores only the newest 2,000 trading-ledger events. Restore applies the same bound. Portfolio state, positions, closed trades, evidence, loop state, and risk/qualification identity remain intact.

## Qualification mutation rule

A qualification checkpoint is fail-closed when any pinned identity changes:

- runtime id
- qualification id
- armed timestamp
- system revision
- strategy version
- risk configuration hash
- initial equity

A code/risk/strategy change therefore requires an explicit qualification restart rather than silently contaminating the current sample.

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
              -> checkpoint
              -> advisory AI / Canonical Event Ledger
```

The legacy and vNext schedulers use separate runtime ids and separate checkpoint rows. No production code path is allowed to promote vNext to live execution authority.
