# ACTIVE SPRINT — BOT Alpha Scanner Flow

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **IN PROGRESS**

## Completed
- BOT-S0 repository boundary bootstrap.
- BOT-S1 scanner input boundary — merged #211.
- BOT-S2 runtime/database ownership contract — merged #212.
- BOT-S3 canonical validation experiment manifest — merged.
- CLEANUP-01 separation ownership audit — merged.
- BOT-S4 immutable validation stage results/evaluation — merged #215 as `f878f1f654c525e2e781b6a124ad1d6d7f8c4935`.
- **BOT-S5 end-to-end Upbit KRW scanner flow — merged #216 as `84b267a286d22d83dd85a544804af147cb7a122f`.**

## BOT-S5 final record

### Objective / delivered
Connected public Upbit market collection → canonical KRW universe → auditable snapshot record → repository persistence → read-time freshness gate → scanner-eligible KRW markets through one fail-closed cycle.

### Acceptance / safety result
- Uses only Upbit public market metadata.
- Persists canonical `UpbitUniverseSnapshotRecord` through the injected repository and re-reads via `readLatestUpbitUniverse`.
- Scanner output is derived from persisted/read-back state, not directly from network payload.
- Collector error, persistence failure, stale/future read-back, identity mismatch and zero eligible markets fail closed.
- Warning/caution exclusions remain preserved.
- `executionAuthority=false`, `capitalAuthority=false`, `liveAuthority=false`.
- No PAPER behavior, Strategy Factory ranking, Router, Council, deterministic Risk, order path, broker secret, private Upbit API, or LIVE behavior changed.

### Research reviewed
- **DI-003 / EXP-DI003** — point-in-time semantics and no laundering of later/stale data.
- **DI-004 / EXP-DI004** — exact snapshot identity and replayable persisted lineage.
- BOT bootstrap review — scanner input integrity precedes Strategy Factory/Council expansion.
- S1 freshness/read-model contract remains canonical.
Research record: `docs/research/2026-09-21-s5-upbit-scanner-flow.md`. No research threshold or alpha claim was promoted into production behavior.

### Verification
- PR #216 final head: `b0922f11ec84c0352aa202a76792f3465ec3eba4`
- Black Oracle CI #1005 — **PASS**
- Black Oracle Trading CI #1184 — **PASS**
- squash merge: `84b267a286d22d83dd85a544804af147cb7a122f`
- deployment/runtime/database mutation: none

### Rollback
Repository-only revert of merge #216. S0-S4 and existing PAPER/runtime remain unchanged; historical snapshot records are not deleted.

## Next work package — BOT-S6 Strategy Factory validation integration

### Objective
Bind Strategy Factory candidate evaluation to the canonical S3/S4 validation experiment/result lineage so candidates cannot become promotion-eligible without explicit Backtest/OOS/Walk-Forward/Monte Carlo/Execution-Cost evidence and fail-closed evaluation status.

### Safety boundary
Validation/promotion evidence only. No automatic Champion promotion, no Router/Risk bypass, no capital authority, no order submission, no unrestricted LIVE. Preserve existing PAPER behavior.

### Rollback
Repository-only revert. Existing scanner flow and PAPER lineage remain authoritative and unchanged.

### Exact next gate
Read Strategy Factory + validation research/ledger → write S6 acceptance criteria before implementation → implement one bounded integration contract → deterministic tests + both required CI green → merge only if verified.

## Current deployment state
No deployment was required for BOT-S5; legacy Railway Black Oracle services remain unchanged. BOT repository/runtime/database separation remains preserved.

## Cycle exit record
- Phase: **BOT-S5 COMPLETE / MERGED**
- Tests: Black Oracle CI #1005 PASS; Trading CI #1184 PASS
- Blockers: none for S5
- Alpha status: S0-S5 complete; S6 queued
- Single next priority: **BOT-S6 Strategy Factory validation integration**
