# BOT-S12 Research Review — Outcome Attribution + Decision Replay Closure

Date: 2026-09-22
Production impact: **None**

## Reviewed research / precedents

- **DI-001 / EXP-DI001** — canonical immutable IDs/hashes and append-only promotion/decision history; replayability is an evidence property, not trading authority.
- **DI-004 / EXP-DI004** — replay should preserve immutable/snapshot-addressable identity where available; snapshot infrastructure remains TEST/REFERENCE and is not introduced by S12.
- **EV-006 / EXP-EV006** — deterministic safety gates remain independent of strategy/Council/Router/LLM; gate failures remain evidence artifacts.
- **S9** deterministic Risk execution boundary — Risk remains mandatory and cannot be bypassed by attribution.
- **S10** `bot.upbit-dry-run-reconciliation.v1` — request/idempotency/Event Ledger/Decision Replay identity is the reconciliation substrate.
- **S11** `bot.live-canary-readiness.v1` — READY means evidence completeness only; submission/execution/capital/LIVE authority remain false.
- Existing `server/decisionReplay.ts` — historical replay currently includes a nearest-entry recovery heuristic. S12 does **not** use heuristic recovery for authoritative attribution: explicit lineage is mandatory and ambiguity fails closed.

## Constraints applied to S12

1. Outcome attribution is an append-only evidence projection; it cannot submit/cancel/resize orders or mutate balances, Risk, routing, governance, strategy selection, or readiness.
2. Explicit lineage is mandatory: request ID, idempotency key, Event Ledger ID, Decision Replay ID and upstream decision IDs must be present and mutually consistent.
3. Only `PAPER` and `LIVE_SHADOW` are valid Alpha modes. No unrestricted LIVE mode is introduced.
4. A readiness `NO_TRADE` result is terminal for attribution acceptance.
5. Missing, future, stale, duplicate or mismatched lineage fails closed.
6. Research remains evidence/constraint only. No external threshold, strategy rule or production behavior is silently promoted.

## Work package

Implement additive `bot.outcome-attribution.v1` with deterministic tests. No database migration, runtime wiring, network order call, credential access or deployment in S12.
