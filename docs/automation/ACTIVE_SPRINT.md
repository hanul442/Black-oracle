# ACTIVE SPRINT — BOT Alpha Runtime / Database Separation

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **IN PROGRESS**

## Current work package — BOT-S2 Independent runtime/database boundary

### Objective
Define the enforceable ownership contract for BOT's independent runtime and database before any new Railway/Supabase binding or data migration. Preserve the legacy PAPER system as read-only migration evidence and prevent accidental cross-product or LIVE authority.

### Acceptance criteria
- Document BOT-owned runtime, database, persistence and secret boundaries.
- Add a machine-readable runtime/database ownership contract with fail-closed validation.
- Explicitly prohibit BOR database ownership, broker secrets in frontend/agents, and implicit LIVE authority.
- Treat legacy PAPER data as read-only migration evidence; no destructive migration in S2.
- Define provisioning and rollback gates before Railway/Supabase binding.
- Add tests proving unsafe ownership/authority combinations are rejected.
- Typecheck, trading tests and production build green before merge.

### Safety boundary
- Documentation + configuration/validation only; no production runtime or DB provisioning in this work package.
- No broker/private Upbit credentials, order submission, portfolio mutation or LIVE authority.
- Deterministic Risk remains mandatory and cannot be bypassed.
- Existing PAPER runtime/data remains untouched.

### Rollback path
Revert the BOT-S2 PR. Because S2 does not provision infrastructure or migrate data, rollback is repository-only and leaves existing PAPER/runtime/database state unchanged.

### Exact next gate
`ownership contract + fail-closed tests → CI green → merge BOT-S2 → provision isolated BOT runtime/database only under the documented contract.`

## Research review for BOT-S2

- **DI-001:** one canonical experiment/lineage identity argues against creating another implicit runtime ledger during separation.
- **DI-003:** point-in-time availability requires preserving legacy observations rather than rewriting them during migration.
- **DI-004:** snapshot-addressable replay requires immutable/read-only migration evidence and stable identities.
- **EV-001 / Q-002:** runtime separation must not silently alter execution/backtest assumptions; engine and cost validation remain later independent gates.

Research disposition: **REFERENCE / TEST constraints only. No trading policy is adopted in S2.**

## Today — ordered plan

- BOT-S0 Repository boundary bootstrap — **DONE**
- BOT-S1 Scanner input boundary — **DONE / MERGED #211**
- BOT-S2 Independent runtime/database boundary — **IN PROGRESS**
- BOT-S3 Validation core — **QUEUED**

## Safety invariants

- Unrestricted LIVE remains blocked.
- `LIVE_CANARY` is readiness-only until explicit qualification.
- Deterministic Risk cannot be bypassed.
- Broker secrets cannot reach frontend/agent contexts.
- Stale/restricted market data fails closed.
- Existing working PAPER behavior and historical lineage are preserved.

## Current known state

- BOT-S1 merged as `a955309b0f54287f1893a851975e9f53cdc10450` after Black Oracle CI #990 and Trading CI #1169 passed.
- Independent BOT runtime/database is not yet provisioned.
- Legacy PAPER remains the protected source of migration evidence.

## Cycle exit record

- Phase: **PLAN + RESEARCH REVIEW COMPLETE → IMPLEMENT**
- Completed this cycle so far: S1 CI verification/merge; S2 plan and research constraints recorded before implementation
- Research reviewed: DI-001, DI-003, DI-004, EV-001, Q-002
- Validation: S1 Black Oracle CI #990 PASS; Trading CI #1169 PASS
- PR: #211 MERGED; S2 PR pending
- Deployment: none
- Blockers: none for repository-level S2 contract
- Next checkpoint: implement BOT runtime/database ownership contract + tests
