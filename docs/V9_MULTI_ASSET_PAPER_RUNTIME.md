# BLACK ORACLE V9 Multi-Asset Paper Runtime

## Purpose

V9 introduces a new Paper qualification runtime where Crypto and KRX equities share one KRW 100,000,000 Paper portfolio. This runtime is separate from the existing `black-oracle-paper-vnext` qualification sample.

## Non-negotiable isolation rule

The existing `black-oracle-paper-vnext` runtime is a pinned qualification sample. Do not add KIS credentials, alter its pinned system identity, reset its checkpoint, or silently extend its asset universe. A code/risk/strategy/data-source change requires an explicit new qualification runtime.

Recommended V9 runtime identity:

- runtime id: `black-oracle-paper-vnext-v9-multiasset`
- initial equity: KRW 100,000,000
- authority: Paper only
- Crypto execution: internal Paper broker
- KRX execution: internal Paper broker
- KIS authority: domestic-equity market data only
- live brokerage execution: disabled

## Shared-capital invariant

Crypto and KRX must not be run as independent portfolios pretending to share capital. The existing `paperLoopController` already owns a single `paperTradingSession` and runs the KRX `equityPaperLoop` from the same cycle when KIS market data is configured. Therefore one scheduled Paper cycle must:

1. acquire the runtime lease,
2. restore the shared checkpoint once,
3. run evidence operations and Crypto decisions,
4. run the KRX cycle when its cadence and market-session gates allow,
5. persist the combined portfolio checkpoint once,
6. append canonical events only after the checkpoint commits,
7. release the lease.

This preserves one cash balance, one position book, one risk surface, and one recovery point.

## KIS readiness gate

`readKisPaperReadiness()` is fail-closed. KRX market-data readiness is `READY` only when:

- `KIS_APP_KEY` is configured,
- `KIS_APP_SECRET` is configured,
- `KIS_ENV` is either `demo` or `real`.

The readiness model never returns credential values. KIS credentials grant market-data access only in BLACK ORACLE; there is no KIS brokerage-order path in this runtime.

Until credentials are configured on the NEW V9 multi-asset Railway service, KRX activation remains `BLOCKED`. This is expected and must not be represented as healthy or active.

## Activation sequence

1. Merge and validate the V9 multi-asset readiness code.
2. Create a new Railway service from `main` with no cron schedule.
3. Configure a unique V9 runtime id and KRW 100,000,000 initial equity.
4. Reuse server-side Supabase/OpenAI/cron configuration through Railway service references where appropriate.
5. Add `KIS_ENV=demo` plus KIS app key/secret directly in Railway; never paste secrets into source control.
6. Bootstrap a fresh qualification checkpoint only.
7. Verify pristine invariants: zero positions, zero closed trades, zero trading events, zero completed cycles.
8. Only then register a dedicated scheduler target for the V9 runtime.
9. Verify the first market-session KRX cycle and canonical lineage before treating the runtime as active.

## Cutover and rollback

The existing vNext runtime remains independently runnable and is never retired automatically. V9 multi-asset qualification can be stopped by disabling/removing its dedicated scheduler target without altering the existing vNext checkpoint.
