# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A17 COMPLETE / BOT-A18 QUEUED**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay UI merged as PR #231 / `6dbe7cf4d7d17f9af2cc4f99a3a0d679f4a688da`.
- BOT-A16 Alpha IA + global Canonical Ledger merged as PR #232 / `bcb81ecf813c9f36325bd2035660ec07a8f754fc`.
- BOT-A17 Alpha release-readiness truth audit merged as PR #235 / `cda0188cd2f806ccad8ba0a05cd55475f5c12603` after exact-head Black Oracle CI #1075 and Trading CI #1253 passed.

## BOT-A17 closeout
A17 is an evidence-only audit. Deployment readiness remains **BLOCKED** because source-health/freshness can be hidden or conflated with verified-empty data. Decision Replay semantics, deterministic Risk/authority boundaries, PAPER lineage, and repository/runtime/database separation remain PASS.

Research reviewed: `BOT-A15-H1/BOT-A15-E1`, `BOT-A16-H1/BOT-A16-E1`, `EV-006/EXP-EV006`, `DI-003/EXP-DI003`, `DI-004/EXP-DI004`, S9 `bot.risk-execution-boundary.v1`, S11 `bot.live-canary-readiness.v1`. Research remains evidence only.

## Safety boundary
Alpha product integration remains read-only unless a separately approved execution package says otherwise. Never expand broker/Risk/order/capital/LIVE authority, expose broker secrets, mutate protected PAPER history, or relax deterministic Risk. Missing or stale source evidence must fail closed.

## BOT-A18 candidate — Canonical Source Health remediation
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

Research review requirement:
- re-read the research ledger and A17 evidence record before implementation
- use A15/A16, EV-006, DI-003 and DI-004 as constraints; do not promote research into execution behavior

Rollback path:
- A18 is bounded to read-only API/source-health contracts and presentation; revert the A18 PR if source truth regresses
- no database/runtime rollback should be required unless an independently verified deployment is deliberately performed later

## Exact next gate
Read the A17 audit and relevant source-health/replay/Risk research contracts; inspect `/api/trading-status`, `/api/strategy-factory-status`, `/api/events` and active shell consumers; implement the smallest coherent fail-closed source-health package on a dedicated branch/PR. Require exact-head Black Oracle CI + Trading CI green and conflict-free before merge. Do not deploy unless runtime verification is separately safe and necessary.

## Current deployment state
Legacy Railway/PAPER services unchanged. No deployment/database mutation performed in A17.

## Cycle exit record
- Phase: **BOT-A17 COMPLETE → BOT-A18 QUEUED**
- Blocker: source health/freshness truth remains a release-readiness blocker, but A18 repository remediation is unblocked
- Alpha status: execution safety baseline intact; deployment-readiness claim remains BLOCKED pending A18
- Single next priority: **A18 canonical source-health / degraded-state remediation**
