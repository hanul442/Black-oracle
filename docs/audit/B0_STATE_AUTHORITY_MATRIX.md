# B0.2 State Authority Matrix

**Sprint / work package:** B0 / B0.2  
**Decision:** PARTIAL — usable as a fail-closed ownership contract, not a B0 exit claim  
**Observed at:** 2026-09-18T22:42:00Z

## Result

The Paper runtime checkpoint is the durable source for positions, order/fill idempotency, runtime-local Ledger state, and qualification identity. The canonical cross-runtime event ledger is a separate append-only store. Strategy Factory and NARS are research/evidence systems and have no execution or promotion authority.

| State | Durable source | Authorized writer | Beta authority | Evidence status |
|---|---|---|---|---|
| Checkpoint | `black_oracle_trading_runtime.checkpoint` | owning Paper runtime through `SupabaseTradingCheckpointStore.save` | read-only | v03 owner verified; other owners partial |
| Positions | `checkpoint.session.portfolio` | `PaperTradingSession` after deterministic Risk | read-only | source verified |
| Orders/fills | `processedOrderIds`, `entryMetadata`, `closedTrades`, session Ledger | `PaperBroker` / `PaperTradingSession` | read-only | source verified |
| Runtime Ledger | `checkpoint.session.ledger` | runtime `TradingLedger` | read-only | source verified |
| Canonical Ledger | `black_oracle_events` | `appendCanonicalEvents` | read-only | source + production catalog verified |
| Strategy identity | checkpoint runtime identity + canonical event identity | pinned runtime/event exporter | read-only | source verified |
| Qualification cohort | checkpoint runtime identity tuple | qualification bootstrap in pinned runtime | read-only | partial; revision mismatch remains |
| Strategy research | factory runs/experiments | research runners | read-only | no execution/promotion authority |
| Scheduler control | scheduler config/lease | scheduler control paths | none | not a state/readiness source |
| NARS | evidence/read models | NARS evidence pipeline | read-only | no execution authority |

## Two Ledgers must remain distinct

`checkpoint.session.ledger` is the runtime-local replay state persisted atomically with the Paper session. `black_oracle_events` is the cross-runtime canonical evidence/event stream. Beta adapters must not merge, rewrite, or substitute one for the other. Missing canonical events cannot be inferred as success from a present session Ledger, and vice versa.

## Production catalog evidence

A sanitized, read-only catalog query confirmed on 2026-09-18:

- `black_oracle_trading_runtime`, `black_oracle_events`, `black_oracle_strategy_factory_runs`, `black_oracle_strategy_experiments`, and `black_oracle_trading_scheduler_config` all have RLS enabled;
- `anon` and `authenticated` have no SELECT privilege on those stores;
- `black_oracle_events` grants `service_role` SELECT/INSERT but not UPDATE/DELETE;
- the append-only trigger exists for both UPDATE and DELETE;
- the other listed legacy stores remain broadly mutable by `service_role`, so B0.3 enforcement is still absent.

No row values, secret values, DDL, role grants, scheduler state, checkpoints, positions, orders, Ledgers, or qualification records were changed.

## Fail-closed rules

1. Report and NARS never supply execution authority.
2. Strategy Factory output never grants execution or promotion authority.
3. Scheduler HTTP status, lease acquisition, and heartbeat do not prove a persisted checkpoint.
4. Qualification identity is the full tuple recorded in the checkpoint; it is not recreated from the runtime ID alone.
5. Unknown, stale, partial, and revision-mismatched ownership remains non-ready.
6. Beta receives no legacy mutation authority until the separately reviewed B0.3 migration passes isolated negative tests.

## Remaining gate blockers

- S2 runs stale source and lacks an exact latest-source deployment control.
- vNext configured/deployed revisions disagree.
- qualification ownership therefore remains PARTIAL.
- B0.3 isolated migration execution is NOT RUN.
- runtime-status external probes remain UNKNOWN.

The machine-readable contract is `ops/b0-state-authority-matrix.json` and is guarded by `scripts/verify-b0-state-authority-matrix.mjs`.
