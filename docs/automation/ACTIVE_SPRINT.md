# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A18 ACTIVE / PACKAGE 1 CI GATE**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay UI merged as PR #231 / `6dbe7cf4d7d17f9af2cc4f99a3a0d679f4a688da`.
- BOT-A16 Alpha IA + global Canonical Ledger merged as PR #232 / `bcb81ecf813c9f36325bd2035660ec07a8f754fc`.
- BOT-A17 truth audit merged as PR #235 / `cda0188cd2f806ccad8ba0a05cd55475f5c12603`.

## BOT-A18 — Canonical Source Health remediation
Objective: make the five primary Alpha surfaces truthfully distinguish healthy, degraded, stale, unavailable, and verified-empty canonical data without changing execution behavior.

Acceptance criteria remain:
- active shell enforces HTTP success before accepting canonical API payloads
- canonical sources expose/retain explicit `OK | DEGRADED | UNAVAILABLE` state and observed-at/freshness metadata
- stale retained data is visibly marked stale/degraded rather than silently presented as current
- Ledger propagates `/api/events` canonical coverage, health degradation and health error metadata
- `trading-status` operational reads distinguish verified-empty from unavailable/non-OK reads
- Overview / Strategy Lab / Trading / Risk / Ledger consume source health consistently
- PAPER behavior, deterministic Risk, strategy promotion, order submission, broker credentials and lineage remain unchanged
- no database migration or unrestricted LIVE authority

## Research reviewed
Re-read central Research Ledger Cycle 011 and A17 audit evidence. Constraints applied: A15/A16 canonical truth, `EV-006/EXP-EV006` deterministic order gate, `DI-003/EXP-DI003` point-in-time integrity, `DI-004/EXP-DI004` replay continuity, S9/S11 authority boundaries. `Q-004/EXP-Q004` remains research-only and outside A18; no research result was promoted into execution behavior.

## Package 1 — canonical Ledger source-health envelope
Implemented the smallest coherent A17-F2 remediation:
- added `server/canonicalSourceHealth.ts` with explicit `OK | DEGRADED | UNAVAILABLE`, observed-at, stale, verified-empty and error semantics
- added regression tests for healthy-empty, stale retained, degraded-error and unavailable fail-closed cases
- `/api/events` now emits `observedAt` and `sourceHealth`, maps producer-health degradation into the canonical envelope, and emits `UNAVAILABLE` on canonical ledger read failure
- preserved existing canonical event payload, coverage and producer-health fields for compatibility
- deliberately did not invent a global event-age freshness threshold; producer health remains authoritative until a source-specific freshness contract is defined

## Safety boundary
Read-only API/source-health work only. No broker/Risk/order/capital/LIVE authority change, credential exposure, PAPER-history mutation, strategy promotion change, database migration or runtime deployment.

## Rollback path
Revert the A18 PR/package. No database/runtime rollback required.

## Verification state
Repository artifacts exist on `bot-a18-canonical-source-health`. CI is the test/verification gate; no PASS is claimed before exact-head workflow evidence exists.

## Exact next gate
Open the A18 PR and require exact-head Black Oracle CI + Trading CI green. If green, continue A18 with active-shell HTTP/stale rendering and `trading-status` unavailable-vs-empty operational reads; if red, fix before any merge. A18 remains incomplete until all five primary surfaces pass the truth audit.

## Current deployment state
Legacy Railway/PAPER services unchanged. No deployment/database mutation performed.

## Cycle state
- Phase: **PACKAGE 1 IMPLEMENTED → CI GATE**
- Alpha deployment-readiness: **BLOCKED pending remaining A18 remediation**
- Single next priority: **verify Package 1 CI, then active-shell fail-closed source-health consumption**
