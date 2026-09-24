# BLACK ORACLE Current-State Audit — 2026-09-24

Status: **AUDIT COMPLETE / NO RUNTIME MUTATION**
Baseline: **BLACK ORACLE Architecture FROZEN v1**

## Executive finding

The current implementation contains substantial reusable BLACK ORACLE capability, but repository governance still describes the older BOT/BOR product split. Frozen v1 supersedes that split as the top-level architecture.

Do not rewrite working PAPER behavior merely to make names match. Migrate by contract and evidence.

## Verified current state

### GitHub

Repositories inspected:

- `hanul442/black_oracle_bot`
- `hanul442/black_oracle_report`
- `hanul442/nars`

The legacy Railway source label `hanul442/Black-oracle` resolves to the current `hanul442/black_oracle_bot` repository identity. Treat it as a stale source label / redirect, not a second independent repository.

Current BOT main contains working contracts and tests for strategy validation, Champion/Challenger, NO_TRADE routing, deterministic Risk, PAPER behavior, canonical event ledger, outcome attribution, and Decision Replay.

Current BOR contains reusable evidence/report/archive contracts and deterministic render/export work, but its README and governance still model BOR as a separate top-level product.

NARS is currently a lightweight dedicated ingestion/ranking repository. Its separation is compatible with Frozen v1 if it remains an Intelligence/Research input producer rather than an authority-bearing decision system.

### Railway

Project: `Black Oracle`
Environment: `production`

Existing services:

1. `black-oracle-web`
2. `black-oracle-paper-vnext`
3. `black-oracle-paper-s2-shadow`
4. `black-oracle-paper-v9-multiasset`

All four currently report successful latest deployments.

A staged Railway environment change remains pending for an unattached diagnostic volume cleanup. Do not apply unrelated infrastructure changes during architecture migration.

### Supabase

Project `black_oracle` reports `ACTIVE_HEALTHY` at the management plane.

However database-level reads remain unavailable. Current observations include connection refusal / database-not-accepting-connections errors, while Edge Function metadata remains readable.

Therefore:

- schema truth is **UNVERIFIED**,
- scheduler row / cron / lease / checkpoint / canonical producer lineage is **UNVERIFIED**,
- single-writer PAPER authority remains **UNKNOWN / BLOCKED**,
- no database mutation is authorized from this audit.

Current relevant Edge Functions include the PAPER scheduler, runtime-status surface, and multiple NARS ingestion/provenance functions.

## Frozen v1 migration classification

| Current component | Disposition | Frozen v1 mapping / reason |
| --- | --- | --- |
| BOT validation / Experiment contracts | **KEEP + MODIFY** | Reuse under Domain D Experiment / Evaluation; remove BOT-only product assumption. |
| Champion–Challenger | **KEEP + MODIFY** | Fits Domains C/D; validation state must remain separate from deployment state. |
| Strategy Router / NO_TRADE | **KEEP + MODIFY** | Fits Domain C Strategy System. |
| Deterministic Risk | **KEEP** | Direct fit for Domain E Hard Risk Gate. |
| PAPER execution contracts | **KEEP + MODIFY** | Preserve behavior; converge behind Domain E runtime contracts after single-writer proof. |
| Canonical Event Ledger / Decision Replay | **KEEP + MODIFY** | Reframe as Domain F Institutional Memory / Decision Run lineage; Ledger is not a top-level system. |
| BOR Evidence / Research / Challenge | **KEEP + MODIFY** | Move conceptually into Domain B Intelligence / Research Pipeline. |
| BOR Report / archive / render contracts | **KEEP + MODIFY** | Move into Domain A Report Artifact + Domain F Archive / Vault. |
| NARS repository | **KEEP** | Domain B intake producer; no trading authority. |
| BOT/BOR as permanent top-level product split | **DELETE AS ARCHITECTURAL RULE** | Superseded by the six-domain architecture. Physical services/repositories may remain temporarily as implementation boundaries. |
| Independent BOR deployment as immediate Foundation blocker | **POSTPONE / RE-EVALUATE** | Frozen v1 does not require BOR to be a separately deployed top-level product. Re-decide topology after contract migration. |
| `black-oracle-web` | **KEEP INTERIM + MODIFY LATER** | Existing gateway/UI/API continuity. Do not redeploy solely for naming. |
| `black-oracle-paper-vnext` | **KEEP PROTECTED** | Candidate canonical PAPER runtime; no authority change until database lineage is proven. |
| `black-oracle-paper-s2-shadow` | **KEEP PROTECTED** | Potential Shadow deployment-state role; verify lineage first. |
| `black-oracle-paper-v9-multiasset` | **POSTPONE / RETIRE CANDIDATE** | Do not delete until writer/event lineage proves it is safe to retire. |
| Supabase PAPER scheduler | **KEEP INTERIM** | Preserve until single-writer reconciliation; later adapt to Domain F orchestration / Domain E runtime. |
| Supabase runtime-status | **KEEP** | Useful observability contract. |
| Existing NARS Edge Functions | **KEEP + CONSOLIDATE LATER** | Do not rewrite before canonical Evidence/data contracts exist. |
| PR #242 Agent OS reference review | **POSTPONE / KEEP REFERENCE** | Useful R&D input; not an implementation mandate. |
| BOR PR #34 PDF renderer | **KEEP ISOLATED / POSTPONE** | Fits future Report Artifact work, not Foundation first. |
| BOR PR #37 Globe design | **KEEP ISOLATED / POSTPONE** | Aligns Frozen v1 Experience/Globe direction; implement only after Foundation contracts. |

## Critical gaps against Frozen v1

### P0 — Supabase data-plane health

Management-plane healthy status is not enough. Database reads currently fail, so Point-in-Time persistence, Decision Run storage, Evidence lineage, evaluation persistence, and PAPER single-writer proof cannot be trusted.

### P0 — Frozen v1 governance is not yet the repository baseline

The existing `docs/ALPHA_ROADMAP.md` still declares the older BOT/BOR split as product truth. This must be treated as operational legacy context only.

### P1 — Point-in-Time contract

The repository has freshness/provenance work, but Frozen v1 requires an explicit canonical temporal contract supporting event time, observed/ingested time, revision identity, and as-of reconstruction.

### P1 — Immutable Decision Run / Version Registry

Existing replay/event lineage is valuable, but Frozen v1 requires one immutable Decision Run identity linking data snapshot → evidence → research → forecast → champion → strategy → risk → execution/non-execution → outcome.

### P1 — Deployment-state separation

Existing Champion/Challenger code must be audited so validation state and deployment state cannot collapse into one authority path.

### P1 — Canonical runtime authority

Multiple legacy PAPER-capable services exist. No retirement or promotion decision is safe until Supabase writer/scheduler/checkpoint/event lineage is readable.

## What must NOT happen next

- Do not start UI redesign.
- Do not deploy BOR merely because the old roadmap called it a blocker.
- Do not delete legacy PAPER services.
- Do not alter scheduler target, runtime ID, Risk, qualification cohort, or protected PAPER history.
- Do not create new LIVE authority.
- Do not add a seventh top-level domain.
- Do not treat a management-plane HEALTHY badge as proof of database health.

## Audit conclusion

The project should not be rebuilt from zero.

The correct path is:

**preserve proven contracts → replace superseded governance → introduce Frozen v1 Foundation contracts → adapt legacy implementations behind those contracts → verify single-writer/runtime lineage → only then expand Decision Engine and Experience.**
