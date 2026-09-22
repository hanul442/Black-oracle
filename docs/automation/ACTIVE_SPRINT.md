# ACTIVE SPRINT — BOT Alpha Execution Safety

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **S13 COMPLETE / S14 ACTIVE**

## Completed
BOT-S0 through BOT-S13 complete. S13 merged #228 as `ba319d22f5d6afaa09b17702596f6c770e2fef9d` and exposed the Risk/order-economics seam rather than hiding it.

## BOT-S14 — canonical order economics ↔ deterministic Risk binding

### Objective
Make deterministic Risk attest the exact canonical order intent consumed by the Upbit dry-run layer, eliminating independent downstream ownership of market/side/quantity/referencePrice while preserving PAPER/LIVE_SHADOW behavior and lineage.

### Acceptance criteria
- one versioned canonical order-intent contract owns intentId, market, side, quantity, referencePrice, strategy identity and freshness.
- deterministic Risk validates canonical identity/economics before ALLOW_INTENT and returns an immutable attestation of those exact economics.
- S10 consumes the Risk attestation; callers cannot inject alternate economics after Risk.
- malformed/non-KRW economics, missing identity, stale/future intent, strategy mismatch, kill switch, duplicate intent and failed limits fail closed.
- S13 integration fixture constructs canonical intent before Risk; no test-only post-Risk economics adapter remains.
- PAPER/LIVE_SHADOW only; all submission/execution/capital/live authorities remain false.

### Safety boundary
Execution-contract hardening only. No broker/network order submission, credentials, secret exposure, runtime/database migration, deployment, unrestricted LIVE, Risk bypass, or new financial authority. Existing PAPER lineage is preserved through deterministic compatibility at the dry-run boundary only where it cannot weaken Risk.

### Rollback path
Close/revert this branch/PR. S0-S13 and existing PAPER/runtime/database state remain unchanged.

### Research review / constraints
Reviewed S9 deterministic Risk, S10 Upbit dry-run/reconciliation and S13 integration audit. Apply research precedents `DI-003/EXP-DI003`, `DI-004/EXP-DI004`, `EV-006/EXP-EV006`, `EV-007/EXP-EV007`: deterministic safety owns execution eligibility; replay/ledger identity must remain reconstructable; integration evidence is required in addition to local PASS. Research remains evidence/constraint only and does not create production thresholds or trading behavior.

### Exact next gate
Implement the smallest versioned canonical intent + Risk attestation, migrate S10/S13 tests, run focused tests and repository CI. Merge only if exact-head Black Oracle CI + Trading CI are green and PR is mergeable. Do not deploy or enable LIVE.

## Current deployment state
Existing legacy Railway/PAPER services unchanged. No S14 deployment/database mutation is authorized or required.

## Cycle exit record
- Phase: **BOT-S14 ACTIVE / IMPLEMENTATION GATE**
- Blocker: **Risk/order economics not mechanically bound; future canary authority remains blocked**
- Alpha status: S0-S13 complete; S14 active
- Single next priority: **canonical order intent attestation through deterministic Risk into Upbit dry-run**
