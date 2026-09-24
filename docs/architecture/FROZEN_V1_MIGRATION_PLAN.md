# BLACK ORACLE Frozen v1 Migration Plan

Status: **PLANNED / NO RUNTIME MUTATION**
Architecture baseline: `BLACK_ORACLE_CANONICAL_FROZEN_V1.md`

## Objective

Move the existing BLACK ORACLE implementation into the Frozen v1 six-domain architecture without discarding already-verified contracts or corrupting protected PAPER lineage.

## Migration rule

**Contract-first, adapter-first, delete-last.**

No legacy service or persistent state is removed until its authority, writer status, consumers, and historical lineage are proven.

## M0 — Governance Sync

- import Frozen v1 canonical source into the repository;
- mark the former BOT/BOR product split as superseded top-level architecture;
- preserve old roadmap/runtime documents as historical operational evidence;
- freeze unrelated feature work during Foundation migration.

Exit: one unambiguous architecture source of truth.

## M1 — Contract Inventory

Map existing implementation to the six domains.

Deliverables:

- current data schemas and read/write owners;
- event types and authority-bearing mutations;
- Evidence/provenance contracts;
- Strategy/Champion/Risk/PAPER contracts;
- version/replay identifiers;
- runtime/service topology;
- KEEP / MODIFY / DELETE / POSTPONE register.

No runtime mutation.

## M2 — Foundation Contract Layer

Implement in this order:

1. Canonical Data Contract
2. Point-in-Time / as-of correctness
3. Immutable Decision Run identity
4. Version Registry basics
5. Event / Trigger Contract
6. Evidence Lineage
7. PAPER-safe Evaluation interface
8. Market / Asset Graph foundation

The first Foundation implementation PR must be additive where possible.

## M3 — Legacy Adapters

Adapt existing proven modules behind Frozen v1 contracts:

- BOT Event Ledger / Replay → Institutional Memory / Decision Run adapters;
- BOT validation → shared Evaluation interface;
- Strategy/Champion → Domain C/D contracts;
- BOR evidence/research → Domain B;
- BOR archive/report → Domains A/F;
- NARS → canonical Evidence intake.

Avoid big-bang repository merges.

## M4 — Runtime Authority Closure

Prerequisite: Supabase data-plane observability restored.

Prove:

- enabled scheduler configuration;
- cron/job invocation;
- lease ownership;
- checkpoint owner;
- producer-tagged event lineage;
- exactly one canonical PAPER writer per delegated runtime;
- Shadow writers are explicitly isolated.

Only after proof classify legacy Railway services for retention or retirement.

## M5 — Decision Engine Closure

Build / reconcile:

`Evidence → Research → Council → Forecast → Strategy Routing → Champion → Trade Planner → Final Decision → Hard Risk`

Validation state and deployment state remain orthogonal.

## M6 — Experience

Only after Foundation/Decision contracts stabilize:

- Home / Dashboard;
- Globe;
- chart-first Asset page;
- Report Artifact;
- Watchlist / Alerts;
- contextual AI Chat.

## Verification gates

Each migration stage requires:

- type/build/test gate;
- deterministic contract tests where applicable;
- no silent authority expansion;
- lineage/version assertions;
- explicit rollback path;
- documentation update.

Before the final Foundation cross-system audit, stop for the requested **Astra final verification pass**.

## Immediate next engineering PR after this governance PR

**Foundation PR #1 — Canonical Data + Point-in-Time contract skeleton**

Scope:

- types/contracts only;
- no DB migration until Supabase health is proven;
- no scheduler/Risk/PAPER behavior change;
- compatibility adapters for existing event/evidence shapes;
- tests proving temporal semantics and no future-data leakage.
