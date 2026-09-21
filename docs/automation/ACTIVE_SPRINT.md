# ACTIVE SPRINT — BOT Alpha Execution Safety

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **S10 ACTIVE — PLAN GATE COMPLETE**

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
- BOT-S9 deterministic Risk + PAPER/LIVE_SHADOW execution boundary — merged #224 as `f74f0b78df43c42a784fa3ec6dafa75c5e9fe8ff`.

## BOT-S10 — Upbit adapter + order dry-run / reconciliation safety contract

### Objective
Add one authority-free Upbit dry-run adapter contract after S9. It converts only a fresh S9-approved PAPER/LIVE_SHADOW intent into a deterministic non-submittable order preview, then reconciles preview identity/lineage without touching broker credentials, balances, orders, runtime state, or database state.

### Acceptance criteria
- Upbit adapter request/response envelopes are explicit and versioned.
- adapter contains no access/secret key fields and returns no credential material.
- `NO_TRADE` is terminal; only S9 `APPROVE` may reach dry-run construction.
- only `PAPER | LIVE_SHADOW` are accepted; runtime `LIVE` payloads fail closed.
- kill switch, stale/future/missing/mismatched lineage, invalid quantity/notional/price and duplicate/idempotency conflict fail closed.
- dry-run output is `submissionAuthority=false`, `executionAuthority=false`, `capitalAuthority=false`, `liveAuthority=false`.
- reconciliation requires deterministic request identity + lineage equality and yields MATCH/NO_TRADE only.
- Event Ledger / Decision Replay lineage fields are preserved in the contract.
- existing PAPER behavior remains untouched; no DB/runtime migration or deployment required.

### Safety boundary
No unrestricted LIVE. No actual Upbit order endpoint. No network submission. No broker secrets. No agent/frontend risk override. No balance mutation. No destructive runtime/database mutation. Missing/stale/ambiguous state fails closed.

### Rollback path
Repository-only revert of the S10 branch/merge. S0-S9 and existing PAPER/runtime/database state remain unchanged.

### Research review / precedents
Constraining precedents: `EV-006/EXP-EV006`, `DI-003/EXP-DI003`, `DI-004/EXP-DI004`, S7 Replay/PAPER parity precedent, S8 governance authority boundary, S9 deterministic Risk boundary, canonical PAPER event fingerprint/export/protection replay lineage. Research remains evidence only; no external threshold/model score is promoted to execution behavior.

### Repository / PR / deployment inspection
- S9 is merged and main records both required CI green.
- unrelated legacy/open PRs remain present; none is an S10 execution-authority prerequisite.
- existing legacy Railway/PAPER deployment remains unchanged.
- S10 is additive repository work only; no deployment is required unless later runtime wiring is separately reviewed.

### Exact next gate
Implement the additive dry-run/reconciliation contract and deterministic tests on `bot/s10-upbit-dry-run-reconciliation`; verify exact commit and both Black Oracle CI + Trading CI; merge only when both are green. No deployment in this work package.

## Current deployment state
Existing legacy Railway/PAPER services unchanged. BOT repository/runtime/database separation preserved.

## Cycle status
- Phase: **BOT-S10 IMPLEMENTATION**
- Blockers: none
- Alpha status: S0-S9 complete; S10 active
- Single next priority: deterministic Upbit dry-run + reconciliation contract
