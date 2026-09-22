# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A18 ACTIVE**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay UI merged as PR #231 / `6dbe7cf4d7d17f9af2cc4f99a3a0d679f4a688da`.
- BOT-A16 Alpha IA + global Canonical Ledger merged as PR #232 / `bcb81ecf813c9f36325bd2035660ec07a8f754fc`.
- BOT-A17 Alpha release-readiness truth audit merged as PR #235 / `cda0188cd2f806ccad8ba0a05cd55475f5c12603` after exact-head Black Oracle CI #1075 and Trading CI #1253 passed.

## BOT-A18 — Canonical Source Health remediation
Objective: make the five primary Alpha surfaces truthfully distinguish healthy, degraded, stale, unavailable, and verified-empty canonical data without changing execution behavior.

Acceptance criteria:
- active shell enforces HTTP success before accepting canonical API payloads
- canonical sources expose/retain explicit `OK | DEGRADED | UNAVAILABLE` state and observed-at/freshness metadata
- stale retained data is visibly marked stale/degraded rather than silently presented as current
- Ledger propagates `/api/events` canonical coverage, health degradation and health error metadata
- `trading-status` operational reads distinguish verified-empty from unavailable/non-OK reads
- Overview / Strategy Lab / Trading / Risk / Ledger consume source health consistently
- PAPER behavior, deterministic Risk, strategy promotion, order submission, broker credentials and lineage remain unchanged
- no database migration or unrestricted LIVE authority

## Safety boundary
A18 is read-only API/source-health/presentation work. It MUST NOT expand broker/Risk/order/capital/LIVE authority, expose broker secrets, mutate protected PAPER history, relax deterministic Risk, or turn research findings into production execution behavior. Missing, stale, malformed, or non-OK source evidence fails closed.

## Research review gate
Before implementation, re-read the central research ledger and A17 audit/evidence material. Constraining precedents: A15/A16 canonical truth contracts, EV-006/EXP-EV006 order gate, DI-003/EXP-DI003 point-in-time integrity, DI-004/EXP-DI004 immutable replay, and S9/S11 authority boundaries. Cycle 011/Q-004 remains research-only and is out of A18 scope.

## Rollback path
Revert the A18 PR. A18 requires no database migration, broker change, execution-policy change, or runtime state mutation; no database/runtime rollback should be required unless a later independently verified deployment is deliberately performed.

## Exact next gate
Inspect A17 audit evidence plus `/api/trading-status`, `/api/strategy-factory-status`, `/api/events` and active-shell consumers on this branch. Implement the smallest coherent fail-closed source-health package, add regression tests, verify exact commit/artifacts, document contract changes, then require exact-head Black Oracle CI + Trading CI green and conflict-free before merge. Do not deploy unless runtime verification is separately safe and necessary.

## Current deployment state
Legacy Railway/PAPER services unchanged. No deployment/database mutation authorized or performed in A18.

## Cycle state
- Phase: **PLAN COMPLETE → RESEARCH REVIEW**
- Alpha deployment-readiness: **BLOCKED pending A18**
- Single next priority: **canonical source-health / degraded-state remediation**
