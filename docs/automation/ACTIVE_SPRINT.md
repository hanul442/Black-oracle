# ACTIVE SPRINT — BOT Alpha Risk / Execution Boundary

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **S8 COMPLETE / S9 QUEUED**

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
- BOT-S8 Council / Red Team / Arbiter governance — merged #221 as `70735bc9765cab9be9021ce5f430d2c849da3e2e`.

## BOT-S8 final record

### Objective / delivered
Added an authority-free deterministic governance contract consuming S7 Router output plus explicit Council and Red Team findings. Router `NO_TRADE` is terminal; a Router selection survives governance only with fresh, identity-consistent Council APPROVE and Red Team CLEAR evidence.

### Acceptance / safety result
- missing/stale/future/mismatched governance evidence fails closed.
- Council rejection and Red Team veto resolve to `NO_TRADE`.
- malformed evidence and authority escalation are rejected.
- governance lineage remains replayable/auditable.
- `promotionAuthority=false`, `executionAuthority=false`, `capitalAuthority=false`, `riskBypassAuthority=false`, `liveAuthority=false`.
- deterministic Risk remains mandatory downstream; PAPER/runtime/database/LIVE behavior unchanged.

### Research reviewed
AIML-002/EXP-AIML002, AIML-003/EXP-AIML003, AIML-004/EXP-AIML004, AIML-005/EXP-AIML005, AIML-006/EXP-AIML006, DI-003/EXP-DI003, DI-004/EXP-DI004, EV-006/EXP-EV006 and S7 precedent. Research record: `docs/research/2026-09-21-s8-governance-contract.md`. No research numerical cutoff, model score or external strategy was promoted.

### Verification
- PR #221 final head: `cfff045a7f5e09d90d5d2415e9782fd4f4c2824b`
- Black Oracle CI #1026 — **PASS**
- Black Oracle Trading CI #1205 — **PASS**
- squash merge: `70735bc9765cab9be9021ce5f430d2c849da3e2e`
- deployment/runtime/database mutation: none

### Rollback
Repository-only revert of merge #221. S0-S7 and existing PAPER/runtime/database state remain unchanged.

## Next work package — BOT-S9 deterministic Risk + PAPER/LIVE_SHADOW execution boundary

### Objective
Bind S8 governance outcomes to an explicit deterministic Risk decision contract and mode-aware execution boundary. `NO_TRADE` must remain terminal. Governance approval alone must never authorize an order. PAPER and LIVE_SHADOW must remain explicitly separated from unrestricted LIVE, with auditable reason/lineage fields and fail-closed handling for stale, missing or inconsistent inputs.

### Acceptance criteria
- deterministic Risk is a mandatory downstream gate after governance and cannot be bypassed by agents, Council, Router or frontend inputs.
- `NO_TRADE` or governance rejection cannot be upgraded downstream.
- missing/stale/future/mismatched risk inputs fail closed.
- execution mode is explicit; Alpha permits bounded PAPER/LIVE_SHADOW contracts only and grants no unrestricted LIVE authority.
- order intent remains non-broker-authoritative unless a later separately verified adapter/dry-run gate grants bounded authority.
- risk/governance/router/strategy lineage and reason codes are replayable.
- no broker secrets enter agent/frontend payloads.
- existing working PAPER behavior is preserved unless a separately verified migration is required.

### Safety boundary
No unrestricted LIVE, no broker-secret exposure, no agent-controlled risk override, no implicit capital authority, no destructive runtime/database migration, and no order submission added by this work package. Fail closed on stale or missing data.

### Rollback path
Repository-only revert of S9 changes. S0-S8 and existing PAPER/runtime/database state must remain recoverable and unchanged.

### Exact next gate
Read deterministic Risk, execution-mode, PAPER/LIVE_SHADOW, event-ledger and Decision Replay research/precedents plus current implementations → record the constraining research IDs/experiments → inspect deployment/runtime ownership → implement one bounded S9 contract with deterministic tests only after those constraints are explicit → verify exact commit and both required CI → merge only when green. Deployment only if a verified runtime change is actually required.

## Current deployment state
No S8 deployment required. Existing legacy Railway/PAPER services remain unchanged; BOT repository/runtime/database separation remains preserved.

## Cycle exit record
- Phase: **BOT-S8 COMPLETE / MERGED**
- Tests: Black Oracle CI #1026 PASS; Trading CI #1205 PASS
- Blockers: none for S8
- Alpha status: S0-S8 complete; S9 queued
- Single next priority: **BOT-S9 deterministic Risk + PAPER/LIVE_SHADOW execution-boundary integration**
