# BOT Upbit Scanner Flow Contract v1

Status: ALPHA CONTRACT
Schema: `bot.upbit-scanner-flow.v1`

## Purpose

Make scanner eligibility depend on one auditable public-data path:

`Upbit public market/all → canonical KRW universe → snapshot record → repository.save → readLatestUpbitUniverse → eligible KRW markets`

The network payload itself is never the final scanner source.

## Invariants

- Public Upbit market metadata only.
- Warning/caution markets remain persisted for audit but are excluded from eligible markets.
- Final scanner markets are derived exclusively from the persisted/read-back record.
- A prior record can remain visible for audit after collector failure but cannot make the failed cycle READY.
- Collection, persistence, freshness or lineage failure returns zero eligible markets.
- Zero eligible KRW markets is an explicit BLOCKED state.

## Fail-closed reasons

- `COLLECTOR_ERROR`
- `COLLECTION_NOT_FRESH`
- `PERSISTENCE_WRITE_FAILED`
- `REPOSITORY_READ_FAILED`
- `NO_SNAPSHOT`
- `STALE`
- `FUTURE_TIMESTAMP`
- `INVALID_TIMESTAMP`
- `PERSISTENCE_READBACK_MISMATCH`
- `NO_ELIGIBLE_MARKETS`

## Authority

Every result fixes:
- `executionAuthority=false`
- `capitalAuthority=false`
- `liveAuthority=false`

This contract cannot promote a strategy, size a position, submit an order, mutate a portfolio or bypass deterministic Risk.

## Replay / lineage

The READY result exposes observed/recorded timestamps and the exact persisted record. Downstream Strategy Factory work should reference this canonical snapshot lineage rather than raw exchange responses.
