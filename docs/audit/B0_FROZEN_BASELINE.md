# BLACK ORACLE B0 — Frozen Baseline Evidence

Status: **IN_PROGRESS**  
Observed: 2026-09-18  
Canonical baseline: `f45d3d08f78dcd2882dafec8429ed9cb46b8024b`  
Governing documents: Product Constitution v2 + `BLACK_ORACLE_BETA_SPRINT_MASTER_PLAN_V2.md`

## 1. Purpose

B0 freezes interpretation before implementation resumes.

This Sprint does **not** authorize runtime migration, scheduler changes, database deletion, live trading, real billing, qualification reset, or historical rewrite.

Its job is to answer four questions:

1. What is actually deployed?
2. Which runtime or process owns each stateful record?
3. What must be preserved, migrated, absorbed, retired, or deleted later?
4. Which blockers must close before B1 can safely build on the system?

## 2. Confirmed canonical product boundary

The repository now uses:

- primary navigation: **Home / Report / AutoTrade / Community**
- Report and AutoTrade as independent products
- rule: **reuse lineage, not authority**
- Report Evidence = research-grade by default
- AutoTrade execution inputs = separately revalidated execution-grade Evidence
- deterministic Risk = sovereign
- current trading authority = **PAPER-only**
- Plan / Capacity / Credits / Profile as separate commercial concepts

Historical qualification and audit records are protected.

## 3. Railway production truth

Project: **Black Oracle**  
Environment: **production**

| Service | Latest observed deploy SHA | Config source | Status | B0 interpretation |
| --- | --- | --- | --- | --- |
| black-oracle-web | `32d3b67` | `main` | SUCCESS | web source follows main, but deployed revision predates canonical docs merge |
| black-oracle-paper-vnext | `8933516` | pinned `7c5bfd0` | SUCCESS | **revision mismatch remains unresolved** |
| black-oracle-paper-s2-shadow | `8c2f27a` | repo source; exact pin not exposed by config | SUCCESS | deployed but scheduler telemetry is stale |
| black-oracle-paper-v9-multiasset | `8c2f27a` | repo source; exact pin not exposed by config | SUCCESS | deployed; current scheduler ownership not established |

A Railway `SUCCESS` status proves deployment completion, **not trading-runtime health**.

## 4. Supabase runtime and scheduler truth

Supabase project: **black_oracle**.

### Durable checkpoint observations

| runtime_id | latest saved_at (UTC) | reason |
| --- | --- | --- |
| black-oracle-paper | 2026-09-13 06:15 | scheduled-paper-cycle |
| black-oracle-paper-native-shadow | 2026-09-18 08:45 | supabase-native-shadow-cycle |
| black-oracle-paper-s2-shadow | 2026-09-10 08:53 | scheduled-paper-cycle |
| black-oracle-paper-vnext | 2026-09-09 11:30 | scheduled-paper-cycle |
| black-oracle-paper-vnext-100m-v03 | 2026-09-18 08:45 | scheduled-paper-cycle |
| black-oracle-paper-vnext-s1r2 | 2026-09-13 05:45 | scheduled-paper-cycle |

### Scheduler target map

| runtime_id | enabled | target | latest scheduler observation |
| --- | ---: | --- | --- |
| black-oracle-paper | yes | black-oracle-web | 2026-09-18 09:00 UTC · HTTP 409 · recorded ok |
| black-oracle-paper-s2-shadow | yes | S2 shadow service | 2026-09-10 06:45 UTC · HTTP 200 |
| black-oracle-paper-vnext | no | vNext service | 2026-09-09 11:30 UTC · HTTP 200 |
| black-oracle-paper-vnext-s1r2 | yes | vNext service | 2026-09-18 14:00 UTC · HTTP 409 · recorded ok |

The deployed scheduler code explicitly treats cycle HTTP 409 as an acceptable downstream result. Therefore `last_ok=true` cannot be interpreted as proof that a new checkpoint was written.

### Supabase-native shadow

The active `black-oracle-native-paper-shadow` Edge Function explicitly owns runtime:

`black-oracle-paper-native-shadow`

and writes its checkpoint under PAPER_SHADOW authority. This ownership is **verified from deployed function source**.

The owner of `black-oracle-paper-vnext-100m-v03` is still unresolved.

## 5. Active cron surface

The database currently has active schedules for:

- Paper scheduler every 15 minutes
- S1R2 scheduler every 15 minutes
- native shadow every 15 minutes
- Strategy Factory daily
- NARS shadow poll / cluster / score
- NARS calibration
- NARS evidence acquisition and primary-evidence matching

B0 must treat these jobs as live production actors even when a corresponding Railway service has not recently written a checkpoint.

## 6. Supabase security/performance observations

All inspected public BLACK ORACLE/NARS tables have RLS enabled. The current advisor reports **INFO**, not WARN/ERROR, for many tables with RLS but no policies.

This may be intentional for service-role-only tables; it is **not** automatically a security defect. Before exposing any of these tables through future product Data API paths, B0/B1 must verify explicit grants and access intent.

Performance advisor reports many unused indexes. **Do not remove them during B0.** Low observed usage may reflect low sample size, shadow pipelines, or future query paths.

Several active Edge Functions use `verify_jwt=false`. Some may implement custom token/cron authentication. Treat them as **REVIEW REQUIRED**, not automatically insecure.

## 7. Migration inventory — first pass

| Classification | Assets |
| --- | --- |
| **KEEP** | deterministic Risk boundary; PAPER checkpoints; Canonical Event Ledger; NARS provenance/evidence history; strategy experiments; qualification cohorts; runtime incidents; Decision Replay concepts; current Supabase scheduler controls until replaced |
| **MIGRATE** | UI read models; instrument identity/universe contracts; market/evidence projections; health/readiness semantics; scheduler ownership registry; profile/entitlement domains |
| **ABSORB** | PR #176 and PR #179 baseline/validator concepts into B0; useful PR #175 product research already captured by Constitution v2; older Monitor/Audit/Positions ideas into AutoTrade + Replay where still useful |
| **RETIRE** | Constitution v1 as active authority; Master Plan v3 as an active beta delivery sequence; old top-level Case/Hypothesis/Scenario UX; duplicate Log/Ledger product surfaces; old navigation specifications |
| **DELETE-LATER** | superseded branches/PR implementation after unique deltas are accounted for; obsolete Firebase-era assumptions; dead UI entrypoints; duplicate mock/demo data |

Deletion is forbidden until dependency and audit-history impact are proven.

## 8. Open-PR disposition

- **#175** — product proposal: **ABSORB / RETIRE**. Canonical product decisions are now in Constitution v2 / Master Plan v3. Do not merge unchanged.
- **#176** — original B0 baseline: **ABSORB AS EVIDENCE**. Preserve its audit findings and validator concepts without merging the stale branch unchanged.
- **#177** — **MERGED / GOVERNING** as `f45d3d08f78dcd2882dafec8429ed9cb46b8024b`. Its B0-B9 sequence is the sole beta delivery/gate authority.
- **#178** — **KEEP** Product Constitution v2, design, and commercial decisions; Master Plan v3 is historical/design context for beta sequencing.
- **#179** — **SUPERSEDED BY THIS PR** after remapping its valid audit evidence from S0 to B0 work packages.
- **#115** — protected S1R2 runtime-integrity branch: **KEEP AS HISTORICAL/QUALIFICATION WORK**, not an implicit merge candidate.
- Older stacked PRs: classify individually before closure or deletion.

## 9. B0 blockers

1. vNext configured/deployed revision mismatch.
2. S2 scheduler/checkpoint freshness ambiguity.
3. `black-oracle-paper` and S1R2 scheduler 409 semantics vs stale durable checkpoints.
4. ownership of `black-oracle-paper-vnext-100m-v03`.
5. exact service/runtime/qualification identity map for all active actors.
6. legacy PR/branch delta accounting.
7. Data API grant/RLS exposure map for future product read models.
8. authentication review for active no-JWT Edge Functions before reuse.

## 10. Exit gate

B0 may move to GATE_REVIEW only when:

- every active scheduler maps to a known runtime and owner,
- every protected checkpoint is classified,
- source/deployed revision truth is documented,
- legacy PRs have a disposition and unique delta inventory,
- no destructive migration is needed to begin S1,
- S1/S2 can consume a stable read-only baseline,
- offline B0 invariant validator passes.

Until then: **B0 IN_PROGRESS / releaseReady=false**.
