# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A18 ACTIVE / PACKAGE 1 TYPECHECK REMEDIATION**

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

## Package 1 CI remediation plan
Exact head `2d89e0f614815b2915198f179d47334cb8166d72` failed Black Oracle CI #1080 and Trading CI #1258 at Typecheck; production build was skipped. Inspection isolates the new helper as the smallest coherent type seam: optional numeric inputs are passed directly to `Number.isFinite`, which requires a number under the repository TypeScript contract. Remediate only that seam with explicit numeric guards; do not change health semantics or widen A18 scope.

### Acceptance criteria for this work package
- optional `now`, `observedAt`, `staleAfterMs`, and `itemCount` are narrowed before `Number.isFinite`
- canonical source-health output semantics remain byte-for-byte equivalent for valid numeric inputs
- no API authority, PAPER, Risk, order, broker, database, or LIVE behavior changes
- exact-head Black Oracle CI + Trading CI must both pass before merge

## Safety boundary
Read-only API/source-health work only. No broker/Risk/order/capital/LIVE authority change, credential exposure, PAPER-history mutation, strategy promotion change, database migration or runtime deployment.

## Rollback path
Revert the A18 PR/package. No database/runtime rollback required.

## Exact next gate
Apply the bounded numeric type narrowing in `server/canonicalSourceHealth.ts`, then require exact-head Black Oracle CI + Trading CI green and conflict-free. Do not merge or deploy on red. If green, continue A18 with active-shell HTTP/stale rendering and `trading-status` unavailable-vs-empty operational reads.

## Current deployment state
Legacy Railway/PAPER services unchanged. No deployment/database mutation performed.

## Cycle state
- Phase: **PACKAGE 1 TYPECHECK RED → BOUNDED REMEDIATION**
- Alpha deployment-readiness: **BLOCKED pending A18**
- Single next priority: **restore exact-head CI green without changing source-health semantics**
