# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A17 ACTIVE — Alpha release-readiness truth audit**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay UI merged as PR #231 / `6dbe7cf4d7d17f9af2cc4f99a3a0d679f4a688da`.
- BOT-A16 Alpha IA + global Canonical Ledger merged as PR #232 / `bcb81ecf813c9f36325bd2035660ec07a8f754fc`.

## BOT-A17 objective
Audit the integrated Alpha shell against canonical runtime contracts before any deployment decision. Produce an evidence-only release-readiness record; do not change trading authority or deploy.

## Acceptance criteria
- every primary surface (Overview / Strategy Lab / Trading / Risk / Ledger) maps to an existing canonical API/runtime source or truthfully exposes unavailable/degraded state
- no UI label overstates execution, Risk, replay, authority, P&L, strategy promotion, or live readiness
- PAPER behavior and lineage remain unchanged
- repository/runtime/database separation remains explicit
- bounded PASS/BLOCKED evidence record identifies exact remediation targets
- no deployment, database migration, broker credential use, or LIVE authority expansion

## Research review gate
Review the research ledger/records and precedents governing Decision Replay, evidence-only UI, deterministic Risk, canary readiness, and product truth integration. Record research IDs/experiments used. Research remains evidence and cannot silently become production behavior.

## Safety boundary
A17 is read-only audit/documentation unless a separately verified presentation defect requires a bounded fix. Never expand broker/Risk/order authority, expose broker secrets, mutate protected PAPER history, relax deterministic Risk, or infer readiness from missing/stale data. Missing evidence is BLOCKED, not PASS.

## Rollback path
A17 audit/documentation changes are additive. Revert the A17 branch/PR if evidence is incorrect. Do not alter merged A16 runtime unless a separately verified defect fix is required. No runtime/database rollback is expected because deployment/migration is prohibited in this package.

## Exact next gate
Complete research review; inspect the five primary surfaces against canonical source contracts and current deployment truth; write the smallest evidence-only A17 audit artifact; run exact-head Black Oracle CI + Trading CI; merge only if both are green and the PR is conflict-free.

## Current deployment state
Legacy Railway/PAPER services unchanged. No deployment/database mutation authorized in A17.

## Cycle state
- Phase: **PLAN COMPLETE → RESEARCH REVIEW / AUDIT**
- Blocker: none for repository audit work
- Alpha status: execution safety baseline complete; product truth audit active
- Single next priority: **A17 release-readiness evidence record**
