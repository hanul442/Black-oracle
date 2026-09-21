# BLACK ORACLE Separation Cleanup Audit — 2026-09-21

Status: CANONICAL CLEANUP MAP  
Alpha target: 2026-10-20

## Purpose

Remove ambiguity left by the former combined BLACK ORACLE repository without deleting historical evidence or importing stale implementation wholesale.

## Canonical ownership

| Capability | Owner | Rule |
|---|---|---|
| Market scanner / Upbit universe | BOT | Public market input and eligibility |
| Strategy Factory / validation / Router | BOT | Trading research and strategy selection |
| Council / Arbiter used for trade decisions | BOT | Never bypass deterministic Risk |
| Risk / execution / PAPER / reconciliation | BOT | BOT-only authority |
| Source / NARS ingestion | BOR | Evidence production only |
| Canonical Evidence / provenance / citations | BOR | No execution authority |
| Research Analysts / report debate / report archive | BOR | Report/research product |
| Credits / billing / entitlements | DEFER | Outside frozen Alpha unless separately approved |
| Shared data | EXPLICIT CONTRACT ONLY | No cross-repository DB reads or writes |

## Legacy PR triage

- **#209 — SUPERSEDED / CLOSE NOW.** BOT-S1 #211 reimplemented the scanner read boundary against separated main and is merged.
- **#200 — MIGRATION SOURCE / DO NOT MERGE.** Contains BOR-worthy Report contracts, analyst/research orchestration, forecast evaluation, report persistence and commercial experiments. Extract only BOR Alpha-relevant assets against BOR contracts. Credits/billing remain deferred.
- **#198 — RESEARCH RECONCILIATION SOURCE.** AIML/Q research must be reconciled with the canonical research ledger before closing. Never merge stale runtime assumptions.
- **#115 — PROTECTED HISTORICAL PAPER REFERENCE.** Frozen qualification/runtime-integrity work; never merge into current main by default.
- **#38 — LEGACY RUNTIME MIGRATION REFERENCE.** Historical Supabase-native PAPER experiment; current BOT runtime/database ownership contract supersedes architecture authority.
- **#39 / #41 / #43 — BOR NARS MIGRATION SOURCES.** Preserve as extraction sources until BOR-S5+ has canonical ingestion/evidence equivalents.
- **#40 — BOT REIMPLEMENTATION SOURCE.** Oracle Harness concepts may inform current validation/evaluation work, but the old branch/base must not be merged wholesale.

## Path ownership rule for future cleanup

- BOT KEEP: trading strategy, validation, Router, Council-for-trading, Risk, execution, paper/live-shadow, reconciliation, event ledger, outcome, replay.
- MOVE/REIMPLEMENT IN BOR: report domain, report research orchestration, NARS/evidence acquisition, report archive, forecast evaluation, analyst registry.
- DEFER: credit economy, billing, subscription entitlements, non-Alpha commercial experiments.
- DELETE only after extraction is verified and rollback history is recorded.

## Safety / rollback

This cleanup changes ownership metadata and PR state only. It does not alter PAPER state, runtime infrastructure, databases, broker credentials, trading authority, or historical commits. Git history remains the rollback source.

## Exit conditions

1. Superseded PRs are closed.
2. Migration-source PRs are explicitly inventoried.
3. BOR owns new report/evidence implementation.
4. BOT contains no new BOR feature development.
5. Cross-product integration uses versioned contracts, never direct database coupling.
