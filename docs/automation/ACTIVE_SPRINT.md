# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A17 AUDIT COMPLETE / RELEASE READINESS BLOCKED**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay UI merged as PR #231 / `6dbe7cf4d7d17f9af2cc4f99a3a0d679f4a688da`.
- BOT-A16 Alpha IA + global Canonical Ledger merged as PR #232 / `bcb81ecf813c9f36325bd2035660ec07a8f754fc`.

## BOT-A17 objective
Audit the integrated Alpha shell against canonical runtime contracts before any deployment decision. Produce an evidence-only release-readiness record; do not change trading authority or deploy.

## Research reviewed
- `BOT-A15-H1 / BOT-A15-E1` — canonical Decision Replay requires verified trace; context is not replay.
- `BOT-A16-H1 / BOT-A16-E1` — five-primary-surface IA/global Ledger is adopted as a read-only slice only.
- `EV-006 / EXP-EV006` — deterministic execution safety remains independent of agent/model authority.
- `DI-003 / EXP-DI003` — missing/stale/future decision evidence fails closed.
- `DI-004 / EXP-DI004` — explicit snapshot/trace identity for replay continuity.
- S9 `bot.risk-execution-boundary.v1` and S11 `bot.live-canary-readiness.v1` — PAPER/LIVE_SHADOW only; readiness/ALLOW_INTENT do not grant order, capital, credential, or LIVE authority.

Research remains evidence; A17 promotes no research behavior into production.

## Audit result
Evidence record: `docs/audit/BOT_A17_ALPHA_RELEASE_READINESS_TRUTH_AUDIT.md`.

- Overview — **BLOCKED**: canonical sources exist, but failed refresh can leave prior state visible without stale/degraded state; HTTP status is not checked before JSON parsing.
- Strategy Lab — **BLOCKED**: same source-health/freshness presentation gap.
- Trading — **BLOCKED**: PAPER data is source-backed, but current freshness cannot be proven during upstream/API failure.
- Risk — **BLOCKED**: no invented thresholds, but some `trading-status` operational Supabase reads collapse unavailable/non-OK to `[]`, conflating unavailable with verified-empty.
- Ledger — **BLOCKED**: `/api/events` returns canonical coverage and health/degradation metadata, but the active shell discards those fields and renders only events.
- Canonical Decision Replay semantic boundary — **PASS**.
- Authority boundary — **PASS**.
- Repository/runtime/database separation — **PASS**.

## Acceptance criteria disposition
- primary surfaces mapped to real sources: **PASS**
- unavailable/degraded truth surfaced: **BLOCKED**
- no overstatement of Decision Replay/authority: **PASS**
- PAPER behavior/lineage unchanged: **PASS**
- repository/runtime/database separation explicit: **PASS**
- bounded PASS/BLOCKED evidence record: **PASS**
- no deployment/migration/credential/LIVE expansion: **PASS**

## Safety boundary
A17 is documentation/evidence only. Never expand broker/Risk/order authority, expose broker secrets, mutate protected PAPER history, relax deterministic Risk, or infer readiness from missing/stale data. Missing evidence is BLOCKED, not PASS.

## Rollback path
Revert the A17 audit PR if evidence is incorrect. No runtime/database rollback is required because A17 performs no deployment or migration.

## Exact next gate
Open the A17 evidence-only PR; require exact-head Black Oracle CI + Trading CI green and conflict-free before merge. After A17 merge, A18 must remediate source-health truth only: explicit `OK | DEGRADED | UNAVAILABLE` load state, `response.ok` enforcement, observed-at/stale labeling, Ledger coverage/health propagation, and unavailable-vs-empty operational read distinction. Preserve PAPER execution behavior.

## Current deployment state
Legacy Railway/PAPER services unchanged. No deployment/database mutation performed in A17.

## Cycle state
- Phase: **AUDIT COMPLETE → PR / CI GATE**
- Release-readiness blocker: **source health/freshness can be hidden or conflated with empty data**
- Alpha status: execution safety baseline intact; product truth audit blocks deployment-readiness claim
- Single next priority: **A18 canonical source-health / degraded-state remediation after A17 evidence merge**
