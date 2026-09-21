# ACTIVE SPRINT — BOT Alpha Execution Safety

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **S11 COMPLETE / S12 ACTIVE**

## Completed
- BOT-S0 repository boundary bootstrap.
- BOT-S1 scanner input boundary — merged #211.
- BOT-S2 runtime/database ownership contract — merged #212.
- BOT-S3 canonical validation experiment manifest — merged.
- CLEANUP-01 separation ownership audit — merged.
- BOT-S4 immutable validation stage results/evaluation — merged #215.
- BOT-S5 end-to-end Upbit KRW scanner flow — merged #216.
- BOT-S6 Strategy Factory validation integration — merged #219.
- BOT-S7 Champion–Challenger + Strategy Router / NO_TRADE — merged #220.
- BOT-S8 Council / Red Team / Arbiter governance — merged #221.
- BOT-S9 deterministic Risk + PAPER/LIVE_SHADOW execution boundary — merged #224.
- BOT-S10 Upbit dry-run + deterministic reconciliation safety contract — merged #225.
- BOT-S11 authority-free Live Canary readiness + execution reconciliation gate — merged #226 as `bef5b745a18bbda4d902461e05b32ea3b4a9d123`.

## BOT-S12 — Event Ledger outcome attribution + Decision Replay closure

### Objective
Close the Alpha evidence loop by deterministically attributing PAPER/LIVE_SHADOW outcomes to the originating scanner → strategy validation → router → governance → Risk → dry-run/reconciliation → readiness lineage. Attribution is observational evidence only and must never acquire execution or financial authority.

### Acceptance criteria
- attribution requires explicit Event Ledger and Decision Replay lineage IDs plus request/idempotency identity; missing, stale, future, duplicate, or mismatched lineage fails closed.
- outcome records are append-only evidence and cannot alter strategy selection, Risk, order submission, balances, or LIVE authority.
- PAPER/LIVE_SHADOW lineage is replayable from decision through reconciliation/outcome.
- deterministic tests cover success plus missing/mismatch/duplicate/future/stale/NO_TRADE paths.
- no broker credentials, network order submission, runtime/database migration, or unrestricted LIVE enablement.

### Safety boundary
Observability/evidence only. No new financial authority, no Risk bypass, no exchange submission, no agent/frontend override, no unrestricted LIVE. Any ambiguous lineage fails closed. Existing PAPER behavior and persistence remain untouched.

### Rollback path
Repository-only revert of S12 changes/PR. S0-S11 and current PAPER/runtime/database state remain recoverable and unchanged.

### Exact next gate
Review DI-001/EXP-DI001, DI-004/EXP-DI004, EV-006/EXP-EV006 and existing Event Ledger / Decision Replay / S9-S11 contracts; record the constraints in an S12 research note; implement one additive deterministic `bot.outcome-attribution.v1` contract with tests; require exact-head Black Oracle CI + Trading CI green before merge. Do not deploy or grant LIVE authority.

## Current deployment state
Existing legacy Railway/PAPER services unchanged. No S12 deployment is planned in this work package. BOT repository/runtime/database separation remains preserved.

## Cycle state
- Phase: **BOT-S12 ACTIVE / PLAN RECORDED**
- Open unrelated PRs observed: #222, #200, #198 and legacy NARS/product PRs; none is allowed to expand S12 scope.
- Blockers: none at plan gate.
- Alpha status: S0-S11 complete; S12 active.
- Single next priority: **implement and verify authority-free outcome attribution closure**.
