# BOT-S10 Research Review — Upbit dry-run / reconciliation

Date: 2026-09-21
Status: implementation constraint record

## Reviewed constraints

- **EV-006 / EXP-EV006** — bounded autonomy: deterministic safety gates remain independently testable and cannot be bypassed by agents, Council, Router or LLMs.
- **DI-003 / EXP-DI003** — point-in-time/freshness semantics must be explicit; stale, future or missing evidence fails closed.
- **DI-004 / EXP-DI004** — snapshot-addressable lineage is required for deterministic replay.
- **S7 Replay/PAPER parity precedent** — adapter comparison is evidence, not authority.
- **S8 governance precedent** — governance approval is only permission to reach deterministic Risk.
- **S9 deterministic Risk precedent** — only S9-approved PAPER/LIVE_SHADOW intent may reach S10; unrestricted LIVE is outside Alpha authority.
- **Canonical PAPER event fingerprint/export/protection replay** — preserve Event Ledger and Decision Replay identifiers rather than creating an alternate lineage system.

## Production disposition

S10 introduces no research-derived trading threshold, model score, strategy, sizing rule or performance assumption. The implementation is an authority-free protocol/safety contract only.

`bot.upbit-dry-run-reconciliation.v1`:

1. accepts an explicit S9 risk contract;
2. rejects `NO_TRADE`, stale/future/missing lineage, kill switch, duplicate idempotency keys, invalid KRW market/numerics and unsupported mode;
3. emits deterministic Upbit-shaped dry-run metadata with no credential fields and all authority flags false;
4. performs deterministic reconciliation of request identity, economic fields and Event Ledger / Decision Replay lineage;
5. never calls an exchange endpoint and never mutates balances, orders, runtime or database state.

## Promotion boundary

This record does **not** authorize actual Upbit submission or LIVE trading. A later Live Canary package must separately establish credentials isolation, exchange-side dry-run/test behavior where available, reconciliation against broker observations, kill-switch operations and explicit financial authority before any order submission can exist.
