# BOT-S9 deterministic Risk + PAPER/LIVE_SHADOW Boundary — Research Review

Date: 2026-09-21
Status: IMPLEMENTATION GATE

## Constraints reviewed
- **EV-006 / EXP-EV006:** autonomous strategy/Council/router output cannot bypass a separately testable deterministic pre-trade safety boundary. S9 adopts the architecture constraint only; it does not import external thresholds.
- **DI-003 / EXP-DI003:** decision-facing observations preserve point-in-time freshness. Missing, stale and future-dated risk snapshots fail closed.
- **DI-004 / EXP-DI004:** decision evidence remains snapshot-addressable. S9 carries risk snapshot identity and governance evidence fingerprint for replay.
- **AIML-002 / EXP-AIML002:** provenance/TEVV records are evidence, not authority.
- **S8 precedent:** governance `APPROVE` is permission to enter the deterministic Risk gate only; governance `NO_TRADE` is terminal.
- **Event Ledger / Decision Replay precedent:** existing implementations demonstrate lineage/replay requirements. S9 remains additive and does not silently wire the new contract into the legacy PAPER runtime.

## Hypothesis — BOT-S9-H1
An additive deterministic boundary can make Risk mandatory after governance and make execution mode explicit while preserving the existing PAPER runtime and granting no broker, capital or LIVE authority.

## Experiment — BOT-S9-E1
Implement `bot.risk-execution-boundary.v1` with `PAPER | LIVE_SHADOW` modes only. It consumes S8 governance lineage plus an explicit risk snapshot. Governance rejection, missing/stale/future/mismatched risk evidence, stale market data, kill switch, duplicate intent or unsatisfied deterministic limits resolve to `NO_TRADE`. A pass emits only `ALLOW_INTENT` with every authority flag false.

## Production boundary
`ALLOW_INTENT` is not an order authorization. The contract cannot submit/cancel/resize orders, allocate capital, access broker secrets, bypass Risk, mutate existing PAPER runtime/database state, or enable unrestricted LIVE. A later separately verified Upbit adapter/order-dry-run package is required before any bounded broker interaction.

## Disposition
**PROCEED WITH ADDITIVE AUTHORITY-FREE CONTRACT.** No external strategy, numerical threshold or performance claim is promoted. Merge requires deterministic tests and both required repository CI workflows green.
