# BLACK ORACLE Master Sprint Plan v3

Status: PROPOSED CANONICAL EXECUTION PLAN
Date: 2026-09-18
Branch: plan/product-redesign-v3
Depends on: BLACK_ORACLE_PRODUCT_CONSTITUTION_V2.md
Supersedes for future planning: BLACK_ORACLE_MASTER_PLAN_V2.md
Preserves: canonical audit data, PAPER outcomes, qualification evidence, Strategy experiments, runtime incidents, Evidence provenance, and all other historically valuable validation records.

---

## 0. Executive Decision

BLACK ORACLE will be rebuilt as one coherent product rather than continuing to accumulate screens and isolated subsystems.

The product has two independent operating modes:

1. **AutoTrade** - an autonomous investment-engine experience that configures and runs strategy portfolios according to investor profile, target, horizon, loss tolerance, and desired level of intervention. Current execution authority is PAPER-only.
2. **Report** - an independent research and market-intelligence product covering supported markets, sectors, equities, crypto, and event-driven research. Reports may be referenced inside AutoTrade as supporting context, but Report is not a mandatory execution gate and does not silently authorize orders.

Research and execution may reuse lineage, source provenance, and instrument identity, but they do not reuse authority.

The engineering program is intentionally **integration-first and product-first at the same time**:

`Foundation -> Mobile Product Shell -> Markets/Evidence -> AutoTrade -> Strategy/Council/Risk -> Trade/Replay -> Report -> Personalization -> Validation -> Monetization -> Realtime -> Production Hardening`

Legacy code may be replaced aggressively when it obstructs the target architecture. Valuable data and decision history must not be destroyed merely because the old code or UI is retired.

---

## 1. Program Operating Model

### 1.1 Sprint size

- One Sprint contains **4-6 implementation sessions**.
- One session is designed for roughly one focused development block.
- Sessions may produce commits independently.
- A Sprint is complete only when its full acceptance gate is passed.

### 1.2 PR model

A **Master Plan PR** defines the canonical roadmap. Each implementation Sprint should then land through a dedicated PR linked back to the Master Plan.

Recommended flow:

```text
MASTER PLAN PR
  -> S0 audit/reset PR
  -> S1 canonical-data PR
  -> S2 product-shell PR
  -> ...
  -> S14 production-hardening PR
```

Every implementation PR should include:

- objective,
- authority impact,
- files/systems changed,
- migrations,
- acceptance criteria,
- automated verification,
- preview or deployed verification,
- rollback path,
- known gaps,
- next dependency.

### 1.3 Definition of Done

A feature is not done because code exists.

The default completion chain is:

`Code -> Tests -> Real contracts -> Error/empty/degraded states -> Mobile QA -> Preview/deployment QA -> Acceptance PASS -> PR review`

### 1.4 Authority discipline

- AI Council starts and remains shadow-only until prospective evidence justifies a higher authority level.
- Deterministic Risk remains sovereign.
- No UI component, Report, LLM output, Strategy score, or Council majority may bypass deterministic risk and execution controls.
- PAPER and later live authority are separate stages.
- Material trading-policy changes require an explicit version boundary and cohort separation.

---

# 2. Target Product Architecture

## 2.1 Global product shell

Approved primary mobile navigation:

**Home / Report / AutoTrade / Community**

BLACK ORACLE may also present a fast **AutoTrade | Report** mode switch in the shared shell.

The switch changes the primary user workflow without pretending that research and execution are the same product. Community is a first-class navigation destination, but interactive social features may remain PLANNED during Beta and must never be simulated with fake activity.

Shared infrastructure may be reused across both modes:

- identity,
- market data,
- instrument registry,
- Evidence Fabric,
- notifications,
- billing/entitlements,
- audit/telemetry,
- profile,
- shared design system.

Mode-specific authority remains separated.

## 2.2 AutoTrade

Target flow:

```text
Investor Profile
  -> Strategy Package / Risk Envelope
  -> Market State + Evidence
  -> Strategy Factory / Vault
  -> Strategy Router
  -> AI Council
  -> Red Team
  -> Arbiter
  -> Deterministic Risk
  -> PAPER Execution
  -> Position / Protection
  -> Outcome
  -> Decision Replay
  -> Calibration / Attribution
```

AutoTrade is not a single-strategy bot. The system should compose a portfolio of strategies appropriate to the investor profile and current market constraints.

## 2.3 Report

Target flow:

```text
Market / Company / Asset
  -> Data + Evidence
  -> Research pipeline
  -> AI analysis
  -> Report
  -> Archive / Compare / Share
```

A report may be linked into an AutoTrade trace as supporting information when relevant.

Report uses **research-grade Evidence**. AutoTrade requires a separately evaluated **execution-grade Evidence Packet** under current market state, freshness, provenance, contradiction, policy, and trace rules.

A Report must remain clearly labeled as reference material and can never inherit execution authority merely because it shares sources or lineage.

## 2.4 Canonical lineage

All execution-side decisions should converge on a stable trace model:

```text
trace_id
  -> instrument
  -> market snapshot
  -> evidence packet
  -> strategy candidates
  -> router decision
  -> council session
  -> red-team challenge
  -> arbiter decision
  -> risk decision
  -> order/fill
  -> position/protection
  -> outcome
  -> calibration/attribution
```

Missing links are rendered as `DATA_GAP`, `NOT_AVAILABLE`, or `NOT_APPLICABLE`; they are never invented for presentation.

---

# 3. Data and Legacy Preservation Rules

The following are **protected assets** during the redesign:

- PAPER orders, fills, positions, closed trades, and outcomes,
- canonical event history,
- Strategy versions and experiment results,
- qualification cohorts,
- Monte Carlo and validation outputs,
- Evidence source/provenance records,
- Council/Arbiter decisions where historically recorded,
- runtime incidents and recovery evidence,
- calibration observations.

The following may be replaced or retired after dependency review:

- obsolete mobile entrypoints,
- duplicated dashboards,
- Cases/Hypothesis/Scenario as top-level product navigation,
- duplicate Ledger/Log surfaces,
- stale demo data,
- obsolete Firebase-era product assumptions,
- unreferenced UI components,
- abandoned stacked PR code that conflicts with current `main`,
- old mockup navigation that no longer matches the new product architecture.

**Rule:** preserve truth; replace presentation and obsolete orchestration.

---

# 4. Sprint Map

## 4.0 Status vocabulary

All roadmap and capability status claims use only:

**DESIGN / PLANNED / IMPLEMENTED / DEPLOYED / VERIFIED / BLOCKED / DEPRECATED / ARCHIVED**

A green CI run, deployment badge, mockup, or merged PR does not by itself mean VERIFIED.

| Sprint | Name | Primary Outcome | Depends on |
| --- | --- | --- | --- |
| S0 | System Audit & Reset | one verified baseline and migration inventory | current main |
| S1 | Canonical Data Foundation | stable entity/trace contracts and read models | S0 |
| S2 | New Mobile App Shell | new mode-aware mobile product shell | S0-S1 |
| S3 | Markets & Evidence | reliable instrument/market/evidence surfaces | S1-S2 |
| S4 | AutoTrade Core | profile-aware PAPER AutoTrade orchestration | S1-S3 |
| S5 | Strategy Factory & Router | strategy competition and explainable selection | S4 |
| S6 | Council & Arbiter | measurable shadow deliberation chain | S5 |
| S7 | Risk & Execution | deterministic execution boundary and protection | S4-S6 |
| S8 | Trade, Portfolio & Replay | inspectable positions, history, trace, outcomes | S7 |
| S9 | Report Product | independent research/report workflow | S2-S3 |
| S10 | Investor Profile & Personalization | onboarding, editable profile, strategy package mapping | S4-S9 |
| S11 | Lab & Validation | experiments, Monte Carlo, champion-challenger | S5-S8 |
| S12 | Pricing, Credits & Entitlements | plan enforcement and usage accounting | S2, S9-S11 |
| S13 | Realtime, PWA & Notifications | installable realtime operator experience | S2-S12 |
| S14 | Production Hardening | qualification-ready release boundary | all prior |

---

# 5. Detailed Sprint Specification

## S0 - System Audit & Reset

### Objective
Establish one source of truth before the redesign touches runtime behavior.

### Sessions
1. **Repository audit** - `main`, current architecture docs, active/stale branches, stacked PRs, legacy surfaces.
2. **Railway/runtime audit** - map services, branches/SHAs, runtime roles, deployment authority, cron/scheduler ownership.
3. **Data-protection inventory** - classify protected audit/qualification data and required backup/migration behavior.
4. **Legacy/deprecation matrix** - KEEP / MIGRATE / ABSORB / RETIRE / DELETE-LATER.
5. **Baseline verification** - lint, trading tests, smoke, build, critical read endpoints.
6. **S0 report + implementation queue**.

### Acceptance
- one baseline commit/SHA is named,
- each Railway service has an explicit role and authority,
- stale PRs are classified rather than blindly merged,
- protected datasets are listed,
- legacy deletion is blocked until replacement parity exists,
- baseline tests have recorded results.

### Authority impact
None. Documentation, inspection, and non-semantic cleanup only unless a separate defect-fix PR is required.

---

## S1 - Canonical Data Foundation

### Objective
Replace implicit cross-module coupling with explicit canonical contracts and projections.

### Sessions
1. Canonical entity schema and stable IDs.
2. Event lineage/trace contract.
3. Recovery state vs event history vs read model separation.
4. Instrument registry and asset-class normalization.
5. Projection APIs for product UI.
6. Migration tests and replay integrity.

### Acceptance
- one completed or rejected decision can be reconstructed without an opaque monolithic checkpoint,
- UI reads from documented projections,
- instrument identifiers are consistent across KRX/crypto/future asset classes,
- missing links are explicit.

---

## S2 - New Mobile App Shell

### Objective
Replace accumulated navigation with a coherent premium mobile-first product shell.

### Sessions
1. IA prototype and mode switch.
2. responsive app shell, header, bottom navigation, safe-area behavior.
3. design tokens and reusable finance components.
4. loading/empty/error/degraded-state system.
5. migration of one real runtime-backed surface.
6. device QA and legacy-shell retirement plan.

### Target UX
- global `AutoTrade | Report` mode switch,
- shared identity/market/profile shell,
- single-column mobile hierarchy,
- full-page drill-down rather than modal-overload,
- live components, not rasterized financial data.

### Acceptance
- 390-430 px mobile baseline passes,
- scrolling and navigation are stable,
- all top-level destinations have a clear purpose,
- no fabricated demo values are needed to make the product look complete,
- old mobile navigation is not removed until functional parity is proven.

---

## S3 - Markets & Evidence

### Objective
Make market truth and Evidence inspectable before execution intelligence consumes them.

### Sessions
1. canonical market universe and instrument discovery.
2. price/OHLCV/freshness contracts.
3. Evidence source ingestion and provenance.
4. Evidence contradiction/staleness model.
5. Markets mobile surface and asset drill-down.
6. data-gap telemetry and QA.

### Acceptance
- Korea Equity and crypto instrument discovery are observable and testable,
- market timestamps/freshness are visible,
- Evidence always exposes source and time,
- data failures degrade locally rather than poisoning the whole app.

---

## S4 - AutoTrade Core

### Objective
Create the actual product-level AutoTrade orchestration.

### Sessions
1. AutoTrade domain model: account, mandate, profile reference, strategy package, authority mode.
2. PAPER run orchestration and lifecycle.
3. candidate -> decision -> execution trace hooks.
4. AutoTrade overview UI.
5. active strategy/risk/position read models.
6. failure/recovery tests.

### Acceptance
- a user can see what AutoTrade is doing now, what it is allowed to do, and why,
- PAPER authority is explicit,
- AutoTrade does not depend on Report completion,
- all generated risk remains under deterministic controls.

---

## S5 - Strategy Factory & Router

### Objective
Turn strategy selection into an inspectable internal market rather than hidden conditional logic.

### Sessions
1. Strategy Vault/Genome normalization.
2. candidate generation and experiment lineage.
3. grade and hard-gate implementation.
4. Router eligibility/conflict/capacity logic.
5. `NO_TRADE` first-class decision handling.
6. strategy competition UI and tests.

### Acceptance
- each candidate has version, evidence, experiment, and grade provenance,
- Router logs eligible/rejected candidates and reasons,
- grade does not directly authorize execution,
- promotion/retirement paths are reproducible.

---

## S6 - Council & Arbiter

### Objective
Make multi-agent review measurable and explicitly subordinate to evidence and risk.

### Sessions
1. Council packet contracts from real data.
2. Round 0 independent opinions.
3. Red Team challenge.
4. revision/debate stage.
5. Evidence-gated Arbiter.
6. prospective evaluation telemetry.

### Acceptance
- FACT / INFERENCE / ASSUMPTION / COUNTEREVIDENCE / DATA_GAP are distinct,
- missing domain data does not trigger invented specialist conclusions,
- Council remains shadow by default,
- baseline-vs-Council incremental value can be measured.

---

## S7 - Risk & Execution

### Objective
Create the non-negotiable deterministic authority boundary.

### Sessions
1. portfolio/risk envelope contract.
2. sizing and exposure constraints.
3. order-intent validation.
4. execution adapters and Paper fills.
5. SL/TP/protection lifecycle.
6. fault injection and rollback.

### Acceptance
- Risk can block Router/Council decisions,
- order duplication and stale-data paths fail closed,
- protective actions remain available under allowed degradation,
- every fill links back to its approved risk decision.

---

## S8 - Trade, Portfolio & Decision Replay

### Objective
Make every active and historical trade understandable from portfolio summary to exact trace.

### Sessions
1. active position and portfolio projections.
2. trade lifecycle and P&L views.
3. history and outcome ledger.
4. Decision Replay timeline.
5. attribution/calibration surfaces.
6. trace drill-down/mobile QA.

### Acceptance
- entry, current price, SL, TP, time, strategy, risk, and outcome are visible where available,
- historical trades are searchable,
- one tap path exists from position to decision lineage,
- unavailable data is labeled rather than omitted silently.

---

## S9 - Report Product

### Objective
Build Report as a complete independent product rather than a subordinate AutoTrade screen.

### Sessions
1. report domain model, versioning, trigger, and research brief schema.
2. report generation pipeline with research-grade Evidence, counterevidence, invalidation, and freshness.
3. market / sector / equity / crypto / Flash report templates and schedules.
4. Report discovery, search, filter, Watchlist, Alerts, and detail UI.
5. archive / compare / export / share-ready structure.
6. explicit reference links into AutoTrade with execution-grade revalidation boundary.

### Acceptance
- Report can be used without AutoTrade,
- AutoTrade can operate without a completed Report,
- Report generation does not directly place or authorize orders,
- reports are versioned, timestamped, provenance-aware, and freshness-aware,
- related AutoTrade links remain references rather than coupled execution inputs,
- 24/7 crypto/event research scheduling cannot expand AutoTrade execution authority.

---

## S10 - Investor Profile & Personalization

### Objective
Map investor intent to a transparent strategy/risk package.

### Sessions
1. onboarding questionnaire and Conservative / Balanced / Growth / Aggressive presets.
2. profile schema: risk, horizon, return objective, maximum loss, intervention preference, asset allowlist, cash / concentration constraints.
3. profile -> strategy package / risk-envelope mapping without cloning strategy identity.
4. editable constraints, policy preview, effective time, and change history.
5. PAPER execution preference: Auto / Confirm / Signal.
6. suitability, hard-block, boundary, and rollback QA.

### Acceptance
- every preset expands to explicit editable values,
- profile and policy changes are versioned,
- strategy package changes are explainable,
- incompatible strategies are blocked with a reason,
- no silent increase in authority or risk follows a profile edit,
- user can inspect the exact constraints currently governing AutoTrade,
- point-in-time Decision Replay can recover the profile/policy version used.

---

## S11 - Lab & Validation

### Objective
Unify research, experiments, Monte Carlo, and Champion-Challenger governance.

### Sessions
1. Experiment Ledger cleanup.
2. OOS/walk-forward framework.
3. Monte Carlo survival and drawdown.
4. Champion-Challenger comparison.
5. grade/calibration dashboard.
6. promotion packet and audit.

### Acceptance
- sample gates are explicit,
- invalid/unavailable statistics are not fabricated,
- experimental success cannot auto-promote to real authority,
- promotion packet is reproducible.

---

## S12 - Pricing, Credits & Entitlements

### Objective
Enforce the approved commercial model while keeping safety, truth, and financial authority independent from monetization.

### Commercial contract

Plan ladder:

**Core -> Plus -> Pro -> Max -> Enterprise**

Capacity multipliers:

**Pro ×2 / ×5 / ×20** expand eligible Pro compute / capacity only. They do not unlock Max-only or Enterprise-only features.

Workload presets:

**Balanced / Strategy / Research** tune resource allocation. They do not silently change plan entitlement, total authority, or historical truth.

### Sessions
1. Plan / Capacity / Credits / Profile domain separation and entitlement matrix.
2. Credit wallet, estimate-before-run, reservation, success/failure/cancel settlement, and usage history.
3. Pro ×2 / ×5 / ×20 capacity enforcement and concurrency controls.
4. Balanced / Strategy / Research workload presets.
5. Report and AutoTrade usage contracts, settings UI, upgrade/downgrade flows, Enterprise contact scaffolding.
6. insufficient-Credit, concurrency, retry, refund/rollback, and entitlement-drift tests.

### Acceptance
- Pro ×20 cannot access Max-only features,
- workload profile changes cannot fabricate capacity or change plan authority,
- plan state cannot alter historical truth,
- entitlement checks exist server-side for protected actions,
- usage accounting is auditable and idempotent,
- ordinary navigation and minimum exposure truth do not consume Credits,
- insufficient Credits cannot hide or lock positions, risk, stops, protection, Decision Replay, audit history, freshness/degraded status, or critical alerts,
- Beta performs no real payment or charge unless separately approved,
- plan copy and actual limits cannot drift silently.

---

## S13 - Realtime, PWA & Notifications

### Objective
Make BLACK ORACLE usable as an installable mobile operator app.

### Sessions
1. PWA manifest/installability.
2. cache/offline strategy for safe read surfaces.
3. realtime updates.
4. trade/system/report notifications.
5. background refresh strategy where supported.
6. mobile install and reconnect QA.

### Acceptance
- PWA installation works on target mobile browsers,
- stale/offline state is obvious,
- notifications do not imply execution that did not occur,
- realtime failures degrade to safe polling/read-only behavior.

---

## S14 - Production Hardening

### Objective
Freeze the redesigned product into a qualification-ready release candidate.

### Sessions
1. security/auth/secret review.
2. data migration and rollback rehearsal.
3. load/performance/reliability tests.
4. full PAPER qualification scorecard.
5. incident/kill-switch/rollback runbook.
6. release candidate audit.

### Acceptance
- critical tests and migrations are reproducible,
- release SHA is tied to deployed SHA,
- trace completeness meets the defined threshold,
- operational incidents have clear response paths,
- live-capital authority remains a separate explicitly approved stage.

### Post-Beta future gate: G10 Live Readiness

G10 is **not** part of v1 Beta delivery and cannot be unlocked by finishing S14 alone.

At minimum it requires:

- broker/account isolation,
- order and position reconciliation,
- credential/permission controls,
- compliance and jurisdiction review where applicable,
- live slippage/fill divergence measurement,
- incident and kill-switch procedures,
- canary-capital stages,
- rollback criteria and explicit human approval.

---

# 6. UI / Information Architecture Redesign

## Global principles

- mobile-first,
- approved primary navigation: **Home / Report / AutoTrade / Community**,
- optional fast **AutoTrade | Report** switch in the shared shell,
- premium fintech, not cyberpunk,
- institutional data discipline with consumer clarity,
- full-page detail for deep work,
- one primary question per screen,
- explain status before decoration,
- explicit timestamps and data freshness,
- interactive financial visuals remain code-rendered.

## Mode architecture

### AutoTrade mode
Primary jobs:
- know what the engine is doing,
- inspect current markets and candidate state,
- understand active strategy and risk,
- inspect positions/trades,
- inspect activity/trace and validation.

### Report mode
Primary jobs:
- select a market/company/asset,
- generate or open research,
- compare research versions,
- inspect sources,
- archive/export/reference reports.

### Shared
- Markets
- Search
- Profile
- Notifications
- Plans/Usage
- System/data status where appropriate

The existing mobile-v1 mockups remain **visual references for tone**, not the final source of truth for navigation.

---

# 7. Legacy / PR Migration Policy

Existing historical branches and draft PRs are evidence and implementation inventory, not automatic merge candidates.

For every legacy PR:

1. identify unique useful delta,
2. verify whether `main` already contains or supersedes it,
3. classify as KEEP / CHERRY-PICK / REIMPLEMENT / RETIRE,
4. do not merge stacked history merely to preserve old work,
5. close or archive only after the useful delta is accounted for.

This prevents the redesign from inheriting contradictory architectures.

---

# 8. Verification Matrix

Every Sprint should select applicable gates from:

- TypeScript: `npm run lint`
- Trading tests: `npm run test:trading`
- Trading smoke: `npm run smoke:trading`
- Production build: `npm run build`
- canonical trace/replay tests
- migration tests
- mobile viewport QA
- Railway preview/deployment verification
- runtime health verification
- data freshness and degraded-state QA
- authority-policy regression tests

A green web deployment alone is never equivalent to trading-runtime health.

---

# 9. Immediate Execution Order

The next implementation sequence is:

1. merge/approve this Master Plan PR together with Product Constitution v2 as planning source of truth,
2. reconcile PR #177 into this canonical plan and close/supersede duplicated planning scope rather than running two competing master plans,
3. execute **S0 System Audit & Reset**,
4. produce a KEEP / MIGRATE / ABSORB / RETIRE / DELETE-LATER map for current UI, runtime, APIs, services, and old PRs,
5. only then begin **S1 Canonical Data Foundation** and **S2 Mobile App Shell**,
6. preserve existing PAPER/audit evidence throughout the transition.

---

# 10. Final Product Definition

BLACK ORACLE is complete only when the operator can answer, from one coherent product:

- What is the market doing?
- What evidence is available and how fresh is it?
- Which strategies competed?
- Why was this strategy selected or rejected?
- What did Council challenge?
- What did deterministic Risk allow?
- What trade actually occurred?
- Where are entry, current price, stop, target, and exposure?
- What happened afterward?
- Which layer added or destroyed value?
- What is AutoTrade currently authorized to do?
- Which Report informed the operator, if any?
- Can the entire decision be replayed from historical truth?

The redesign prioritizes **truth, traceability, controlled autonomy, and product clarity** over preserving obsolete interfaces or accumulated code.
