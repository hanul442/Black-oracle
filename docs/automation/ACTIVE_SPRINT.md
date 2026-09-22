# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A16 COMPLETE / BOT-A17 QUEUED**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay UI merged as PR #231 / `6dbe7cf4d7d17f9af2cc4f99a3a0d679f4a688da`.
- BOT-A16 Alpha IA + global Canonical Ledger merged as PR #232 / `bcb81ecf813c9f36325bd2035660ec07a8f754fc`.

## BOT-A16 closeout
- Overview / Strategy Lab / Trading / Risk / Ledger are the five primary destinations.
- Markets and Oracle remain contextual drill-ins.
- Global Ledger is read-only over canonical `/api/events` truth with event/type/market/strategy/source/authority filtering.
- Source, authority, severity and trace availability are visible.
- Trace availability does not imply Decision Replay; BOT-A15 remains the verified replay path.
- Risk surface uses observed drawdown, daily P&L, open positions and recent Risk rejects only; no invented thresholds.
- Final exact PR head `a88ca5c4f57036d2f03d7e9d76ec87a93978ad76` passed Black Oracle CI #1067 and Black Oracle Trading CI #1245; PR was mergeable and squash-merged.
- Research disposition: BOT-A16-E1 = **ADOPT** for the read-only product slice only; it does not grant trading authority.

## Safety boundary
Alpha product integration remains read-only unless a separately approved execution package says otherwise. Never expand broker/Risk/order authority, expose broker secrets, or mutate protected PAPER history. Preserve deterministic Risk and fail closed on missing/stale execution evidence.

## BOT-A17 candidate — Alpha release-readiness truth audit
Objective: audit the now-integrated Alpha shell against canonical runtime contracts before any deployment decision.

Acceptance criteria:
- every primary surface maps to an existing canonical API/runtime source or truthfully exposes unavailable/degraded state
- no UI label overstates execution, Risk, replay, authority, P&L, strategy promotion, or live readiness
- PAPER behavior and lineage remain unchanged
- repository/runtime/database separation remains explicit
- produce a bounded release-readiness evidence record with PASS/BLOCKED findings and exact remediation links
- no deployment, database migration, broker credential use, or LIVE authority expansion

Research review requirement:
- review the research ledger plus the precedents governing Decision Replay, evidence-only UI, deterministic Risk, canary readiness, and product truth integration
- record IDs/experiments used; research remains evidence and cannot silently become production behavior

Rollback path:
- audit/documentation changes are additive; revert the A17 audit commit/PR if evidence is incorrect
- do not alter the merged A16 runtime unless a separately verified defect fix is required

## Exact next gate
Read the research ledger and relevant architecture/research contracts, inspect each of the five primary surfaces against its canonical source, then open the smallest evidence-only A17 audit PR. Merge only with exact-head Black Oracle CI + Trading CI green and conflict-free.

## Current deployment state
Legacy Railway/PAPER services unchanged. No deployment/database mutation performed in A16.

## Cycle exit record
- Phase: **BOT-A16 COMPLETE → BOT-A17 QUEUED**
- Blocker: none for repository audit work
- Alpha status: execution safety baseline complete; product truth integration continuing toward Alpha v0.1
- Single next priority: **A17 release-readiness truth audit**
