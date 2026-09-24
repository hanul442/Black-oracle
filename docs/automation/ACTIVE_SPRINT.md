# ACTIVE SPRINT — Frozen v1 Foundation Migration

Date: **2026-09-24**
Target: **Foundation Closure before Decision Engine expansion**
Status: **GOVERNANCE SYNC / RUNTIME MUTATION FROZEN**

## Canonical authority

- Top-level architecture: `docs/architecture/BLACK_ORACLE_CANONICAL_FROZEN_V1.md`
- Current-state audit: `docs/runtime-truth/CURRENT_STATE_AUDIT_2026-09-24.md`
- Migration plan: `docs/architecture/FROZEN_V1_MIGRATION_PLAN.md`

The earlier BOT/BOR split is no longer the top-level architecture. Existing repositories and services remain implementation boundaries until deliberately migrated.

## Current verified runtime truth

- Railway `Black Oracle` production contains four legacy services: web, vnext PAPER, s2 shadow, v9 multiasset.
- Latest deployments report SUCCESS.
- Supabase management plane reports `ACTIVE_HEALTHY`, while database reads still fail with connection/data-plane errors.
- Supabase Edge Function metadata remains readable.
- PAPER single-writer authority is therefore **UNKNOWN / BLOCKED**.

## Sprint goal

Prepare Foundation PR #1 without mutating protected runtime state.

Required work:

1. inventory existing canonical data/event/evidence/version contracts;
2. define Frozen v1 Canonical Data Contract;
3. define Point-in-Time temporal semantics;
4. define immutable Decision Run / Version Registry interfaces;
5. define compatibility adapters for existing Event Ledger / Replay / Evidence shapes;
6. add contract tests;
7. stop before any database migration or runtime behavior change if Supabase remains unavailable.

## Frozen during this sprint

- scheduler target/cadence/runtime IDs;
- Risk parameters;
- PAPER writer authority;
- qualification history;
- LIVE authority;
- broad UI redesign;
- isolated BOR deployment;
- retirement of legacy Railway services.

## Exit gate

Foundation PR #1 is ready when contract semantics and compatibility tests are green, no runtime mutation is required, and the implementation can be reviewed against Frozen v1.

Before the final Foundation cross-system audit, stop for an Astra final verification pass.
