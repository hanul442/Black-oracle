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

## Active — BOT-S5 End-to-end Upbit KRW scanner flow

### Objective
Connect public Upbit market collection → canonical KRW universe → auditable snapshot record → repository persistence → read-time freshness gate → scanner-eligible KRW markets through one fail-closed cycle.

### Acceptance criteria
- Use only Upbit public market metadata.
- Persist only canonical `UpbitUniverseSnapshotRecord` through the injected repository.
- Re-read through `readLatestUpbitUniverse`; scanner output must come from the persisted/read-back record, not directly from the network payload.
- HTTP/payload failure, persistence failure, stale/future read-back, read-back identity mismatch, or zero eligible KRW markets must fail closed.
- Previous persisted record may remain visible for audit but cannot make a failed collection cycle scanner-ready.
- Preserve warning/caution exclusions.
- Result exposes explicit status/reason, snapshot lineage and eligible markets.
- `executionAuthority=false`, `capitalAuthority=false`, `liveAuthority=false`.
- No PAPER behavior, Strategy Factory ranking, Router, Council, deterministic Risk, order path, broker secret, private Upbit API, or LIVE behavior changes.
- Add deterministic tests for success, collector failure, persistence failure, read-back mismatch, zero eligible universe and stale read-back.

### Research review
- **DI-003 / EXP-DI003** — point-in-time semantics and no laundering of later/stale data.
- **DI-004 / EXP-DI004** — exact snapshot identity and replayable persisted lineage.
- BOT bootstrap review — scanner input integrity precedes Strategy Factory/Council expansion.
- Existing S1 freshness/read-model contract remains canonical.
No research threshold or alpha claim is promoted into production behavior.

### Safety boundary
Discovery/scanner eligibility only. No execution, portfolio, broker credential, Risk bypass, PAPER/LIVE mutation or unrestricted LIVE authority.

### Rollback
Revert BOT-S5 PR. S0-S4 and existing PAPER/runtime remain unchanged; persisted historical records are not deleted.

### Exact next gate
`implement scanner flow → Black Oracle CI + Trading CI green → merge BOT-S5 → Strategy Factory validation integration`.

## Current deployment state
Legacy Railway Black Oracle services remain unchanged and successful. No deployment is required for this repository-only scanner contract.

## Single next priority
BOT-S5 end-to-end Upbit KRW scanner flow.
