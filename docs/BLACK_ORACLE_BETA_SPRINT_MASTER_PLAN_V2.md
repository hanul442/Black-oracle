# BLACK ORACLE v1.0.0-beta.1 Sprint Master Plan v2

**Status:** GOVERNING ON MERGE  
**Target:** `v1.0.0-beta.1` private beta  
**Execution mode:** hourly development sessions, evidence-gated  
**Trading boundary:** PAPER ONLY

## 1. Authority and purpose

This document is the governing delivery plan for the Report + AutoTrade beta. After it is merged, every beta implementation PR must reference one Sprint ID and one or more acceptance criteria from this plan.

It supersedes `docs/BLACK_ORACLE_SPRINT_ROADMAP_V1.md` only for the `v1.0.0-beta.1` product delivery sequence. The older roadmap remains historical architecture context; it does not authorize Live execution or override this beta scope.

Existing production and qualification work remains valid evidence. In particular, `docs/automation/ACTIVE_SPRINT.md` is an unresolved legacy runtime/deployment checkpoint that B0 must preserve and reconcile, not silently mark complete.

### 1.1 Reconciliation with the 2026-09-18 redesign baseline

PR #178's Product Constitution v2, product navigation, design system, open-core boundary, and safety/commercial decisions remain valid. For `v1.0.0-beta.1` delivery order, acceptance gates, stop conditions, and Sprint IDs, this file is the sole authority after merge.

`docs/BLACK_ORACLE_MASTER_PLAN_V3.md` is retained as design and historical planning context, but its S0-S14 sequence does not run in parallel with B0-B9. Existing S0 audit artifacts and PR #179 are reusable B0 evidence only after their manifests, validators, PR metadata, and active-sprint records are mapped to B0 work-package IDs. They do not independently advance a beta gate.

PR #176 remains the original B0 baseline execution record. PR #179 may supersede its implementation only through an explicit B0 reconciliation that preserves all evidence and closes duplicate branches without rewriting protected runtime history.

## 2. Release outcome

The beta is complete only when a user can:

1. use Report independently for current, evidence-linked market research;
2. inspect, compare, and select strategies using reproducible metrics;
3. configure an investor policy and run a PAPER-only AutoTrade portfolio;
4. reconstruct decisions, orders, positions, and risk blocks;
5. see truthful freshness, failure, and degraded states;
6. use plan entitlements and test Credits without real billing;
7. operate the product continuously with observable recovery behavior.

Report may inform a user, but it is never a required order input and may never bypass deterministic Risk. AutoTrade must remain usable without Report generation.

## 3. Non-negotiable invariants

- No Live order route, broker credential, withdrawal permission, or real-money authority.
- No destructive migration or rewrite of legacy positions, orders, Ledger, checkpoints, strategy identities, or qualification cohorts.
- Legacy stores are read-only to beta adapters until a separately reviewed migration is approved.
- Backtest, Forward, and Paper performance are separate streams.
- Missing, stale, failed, partial, and unrun data are never represented as zero or success.
- Deterministic Risk cannot be bypassed by Council, Report, user plan, Credit balance, or execution mode.
- Core / Plus / Pro / Max / Enterprise are feature tiers.
- Pro ×2 / ×5 / ×20 change capacity only; they do not unlock Max features.
- Balanced / Strategy / Research are Pro-and-above workload profiles, not feature entitlements.
- Production deployment success is not runtime readiness; deployed source revision and health semantics must be verified separately.
- Secrets, private Alpha parameters, raw customer data, and credentials must never appear in commits, logs, issues, or PR bodies.

## 4. Delivery sequence

| Sprint | Goal | Primary deliverables | Entry dependency | Exit decision |
|---|---|---|---|---|
| B0 | Freeze and prove the baseline | deployment/source manifest, data ownership map, beta invariants, rollback rules | current main | PASS / EXTEND |
| B1 | Establish the beta shell | Report/AutoTrade routes, navigation, state components, verified design assets | governing plan + B0 contract | PASS / EXTEND / ROLLBACK |
| B2 | Build the Report domain | report/version/evidence/trigger/freshness models and generation contract | B1 shell contract | PASS / EXTEND |
| B3 | Ship the Report experience | overview, asset views, detail, watchlist, alerts | B2 API/read model | PASS / EXTEND / ROLLBACK |
| B4 | Make strategies comparable | metric contract, lifecycle, Strategy Library, reproducible ranking | B0 data boundary | PASS / EXTEND |
| B5 | Add investor policy | presets, editable constraints, suitability, policy history | B4 strategy contract | PASS / EXTEND |
| B6 | Connect PAPER AutoTrade | portfolio, positions, allocation, orders, risk, replay, stop control | B4 + B5 | PASS / EXTEND / ROLLBACK |
| B7 | Operate continuously | schedules, queues, idempotency, freshness, recovery, cost telemetry | B2 + B6 | PASS / EXTEND / ROLLBACK |
| B8 | Enforce plans and Credits | entitlements, test wallet, capacity, usage, settlement rules | stable B2–B7 work units | PASS / EXTEND |
| B9 | Harden and release | integrated QA, security, rollback drill, private beta package | B0–B8 passed | RELEASE / NO GO |

B0 through B9 are ordered release gates. Work may be parallelized inside an active sprint. Enabling work for the next sprint may begin only when it cannot alter production behavior or create an incompatible contract. A later sprint cannot be declared passed before its dependencies.

## 5. Sprint specifications

### B0 — Frozen Baseline

**Objective:** establish what is running, who owns each stateful record, what beta may read or write, and how every mutation can be rolled back.

**Work packages**

- B0.1 deployment SHA, configured revision, branch, scheduler, and health-semantics inventory;
- B0.2 runtime ID, checkpoint, Paper position/order, Ledger, and NARS ownership map;
- B0.3 legacy read-only and beta-write namespace contract;
- B0.4 v0.x freeze, Paper-only invariant, and rollback rules;
- B0.5 reconcile open PRs and older roadmaps against this plan;
- B0.6 close or explicitly carry forward S2 stale-source and vNext revision blockers.

**Exit gate**

- service/source truth is evidence-backed and UNKNOWN remains UNKNOWN;
- state ownership and scheduler targets are verified through a sanitized read-only path;
- beta write namespaces cannot mutate legacy state;
- rollback targets and protected qualification boundaries are documented;
- baseline validator, relevant regressions, typecheck, and build pass;
- no production cutover is authorized by documentation alone.

**Current execution PR:** #176. Its audit findings remain provisional until merged.

### B1 — Beta Shell and Design System

**Objective:** create the new application skeleton without inventing product data.

**Work packages**

- B1.1 top-level `REPORT ↔ AUTOTRADE` mode switch with URL/state preservation;
- B1.2 mode-specific sidebars, global search, alerts, and user menu;
- B1.3 shared loading, empty, stale, degraded, error, and unavailable states;
- B1.4 responsive desktop/mobile layout and accessibility baseline;
- B1.5 integrate RectangleButtons only from the approved ThreeUI source bundle with SHA-256 verification;
- B1.6 route and component tests plus browser verification.

**Exit gate**

- navigation and state survive mode changes and refreshes;
- keyboard, focus, reduced-motion, mobile, and desktop checks pass;
- no fabricated report, return, position, or runtime status;
- design assets match verified source hashes;
- no production cutover while relevant B0 safety blockers remain open.

### B2 — Report Domain and Generation

**Objective:** create a versioned, evidence-linked Report system independent from order execution.

**Work packages**

- B2.1 canonical Asset, Market, and Sector identity;
- B2.2 Report, ReportVersion, ReportEvidence, ReportTrigger, and FreshnessStatus;
- B2.3 Market Brief, Sector, Equity, Crypto, Flash, and Update contracts;
- B2.4 state machine: QUEUED → GENERATING → PUBLISHED → UPDATING → STALE, plus FAILED and INSUFFICIENT_DATA;
- B2.5 source, counter-evidence, invalidation, timestamp, and lineage requirements;
- B2.6 idempotent generation and version persistence tests.

**Exit gate**

- a report version is immutable and reconstructable;
- new publication and update are distinguishable;
- failure, delay, insufficient evidence, and stale state are truthful;
- Report has no execution authority and is not required by AutoTrade;
- API/contract tests and persistence rollback tests pass.

### B3 — Report Experience

**Objective:** make the Report domain useful on desktop and mobile.

**Work packages**

- B3.1 Report Overview and market/sector/stock/crypto collections;
- B3.2 Report Detail with summary, scenarios, evidence, counter-evidence, charts, invalidation, and history;
- B3.3 search, filter, sort, Watchlist, and Alerts;
- B3.4 freshness, source time, update state, and related-report navigation;
- B3.5 accessible chart fallbacks, responsive priority order, and browser QA.

**Exit gate**

- collection navigation and filters operate on real contracts;
- primary risk and freshness are visible without deep navigation;
- related AutoTrade links are references only, not coupled execution inputs;
- empty/degraded/error states are tested;
- critical user journeys pass browser and mobile verification.

### B4 — Strategy Metrics and Library

**Objective:** compare strategies on reproducible, like-for-like evidence.

**Work packages**

- B4.1 lifecycle: Candidate, Backtested, Forward Testing, Paper Qualified, Active, Watch, Quarantined, Retired;
- B4.2 metric specification for cumulative, annualized, 30/90-day return, drawdown, volatility, Sharpe, Sortino, win rate, Profit Factor, trades, validation period, and benchmark delta;
- B4.3 fee, slippage, benchmark, timeframe, sample, and provenance labels;
- B4.4 minimum-sample and risk-adjusted default ranking rules;
- B4.5 Strategy Library compare, filter, status history, and suitability hooks;
- B4.6 deterministic fixtures and independent metric-reproduction tests.

**Exit gate**

- Backtest, Forward, and Paper cannot be mixed or silently aggregated;
- insufficient samples are excluded from ranks and labeled;
- every displayed metric links to a reproducible calculation snapshot;
- missing/partial values remain unavailable rather than zero;
- lifecycle transitions are versioned and auditable.

### B5 — Investor Profile and Policy

**Objective:** translate investor preferences into explicit, versioned allocation and risk constraints without cloning strategies.

**Work packages**

- B5.1 Conservative, Balanced, Growth, and Aggressive presets;
- B5.2 risk tolerance, maximum loss, horizon, asset allowlist, minimum cash, concurrent positions, strategy cap, and concentration limits;
- B5.3 Auto, Confirm, and Signal modes;
- B5.4 suitability evaluation and hard-block reason contract;
- B5.5 policy preview, effective time, history, and rollback;
- B5.6 boundary and property tests for every hard limit.

**Exit gate**

- every preset expands to editable explicit values;
- policy changes show expected risk/frequency impact before activation;
- incompatible strategies are blocked with a reason;
- original strategy identity and performance remain unchanged;
- policy history supports point-in-time Decision Replay.

### B6 — PAPER AutoTrade Portfolio

**Objective:** connect eligible strategies and investor policy to a fully traceable Paper portfolio.

**Work packages**

- B6.1 Portfolio Overview, Positions, Strategy Allocation, Orders & Activity, Risk, Replay, and Settings;
- B6.2 signal → suitability → portfolio policy → deterministic Risk → execution-mode pipeline;
- B6.3 Paper order idempotency, position accounting, and strategy P&L attribution;
- B6.4 Auto, Confirm, and Signal behavior;
- B6.5 immediate user stop, fail-closed degradation, and safe restart;
- B6.6 end-to-end lineage from strategy/version and policy/version to risk result, order, fill, position, and outcome.

**Exit gate**

- all three execution modes behave as specified;
- Risk blocks cannot be overridden;
- duplicate and orphan orders/positions are zero in the validation suite;
- stop control prevents new Paper orders;
- Decision Replay is complete for a fill and a NO TRADE/block;
- repository contains no Live order path introduced by beta work.

### B7 — 24/7 Operations and Observability

**Objective:** run Report and Paper AutoTrade continuously without hiding failure.

**Work packages**

- B7.1 market-aware daily/weekly schedules, crypto continuous events, and Flash triggers;
- B7.2 queues, leases, retry budgets, deduplication, and Job Replay;
- B7.3 data freshness, queue lag, job latency, service health, and cost/Credit telemetry;
- B7.4 failure alerts, degraded modes, AutoTrade fail-closed behavior, and recovery playbooks;
- B7.5 time-zone, holiday, restart, and partial-outage tests;
- B7.6 soak test with evidence capture.

**Exit gate**

- duplicate publication and duplicate order mutation are zero;
- failed work never presents old output as current;
- AutoTrade stops new orders when required dependencies are unsafe;
- recovery resumes idempotently;
- soak duration and thresholds are declared before the run and results are attached to the gate record.

### B8 — Pricing, Credits, and Entitlements

**Objective:** enforce the approved commercial model in a test-only billing environment.

**Work packages**

- B8.1 Core, Plus, Pro, Max, and Enterprise entitlement matrix;
- B8.2 Pro ×2/×5/×20 capacity multipliers;
- B8.3 Balanced/Strategy/Research workload profiles;
- B8.4 monthly test wallet, estimate-before-run, reservation, success/failure/cancel settlement, and usage history;
- B8.5 concurrency and capacity controls;
- B8.6 upgrade and Enterprise-contact flows.

**Exit gate**

- Pro ×20 cannot access Max-only features;
- profile changes do not change total entitlement or fabricate capacity;
- ordinary UI, market data, portfolio state, positions, and risk alerts remain accessible without Credit charge;
- concurrency cannot double-charge;
- insufficient Credits cannot hide or lock risk/position information;
- no real payment or charge is executed.

### B9 — Hardening and Private Beta Release

**Objective:** prove the entire product can be released and rolled back safely.

**Work packages**

- B9.1 integrated Report/AutoTrade independence and user-journey QA;
- B9.2 metric reproduction, policy, Risk, order, position, replay, and Credit concurrency audits;
- B9.3 accessibility, mobile, performance, security, permissions, and secret scans;
- B9.4 DB migration rehearsal, backup/restore, deployment SHA verification, and rollback drill;
- B9.5 release notes, known limitations, operator runbook, and invitation cohort;
- B9.6 `v1.0.0-beta.1` tag candidate and release decision record.

**Release gate**

- critical defects: 0;
- Live trading paths introduced by beta: 0;
- unexplained metric mismatches: 0;
- duplicate/orphan orders and positions: 0;
- missing Replay lineage for sampled decisions: 0;
- false-success and stale-as-current states: 0;
- approved commit, deployed SHA, and runtime-reported revision agree;
- rollback drill passes;
- all open limitations are explicitly accepted.

Any failed item produces NO GO or EXTEND, never an assumed pass.

## 6. PR architecture

### Governing rule

Every implementation PR must include:

- Sprint ID and work-package IDs;
- acceptance criteria addressed;
- explicit scope and non-scope;
- authority impact: NONE, SHADOW_ONLY, or an explicitly approved level;
- qualification and lineage impact;
- validation evidence;
- deployment target and rollback;
- follow-up items and remaining gate blockers.

### PR sizing

A development session may complete multiple non-conflicting work packages. Reviewability is controlled at PR level:

- one coherent contract or user outcome per PR;
- separate product UI, persistence migration, runtime authority, and infrastructure mutations unless inseparable;
- stacked PRs are allowed only with explicit base and dependency;
- no PR is merged merely because the next hourly session has started.

### Initial PR queue

1. **Plan PR:** this document.
2. **B0 / baseline PR:** #176, updated to reference the merged plan and preserve `B0 IN_PROGRESS` until its gate is proven.
3. **B0 reconciliation PR(s):** source/ownership verification and stale-deployment resolution, split by risk boundary.
4. **B1 shell PR:** routes, mode switch, navigation, and shared truthful data states.
5. **B1 design-source PR:** verified RectangleButtons assets and accessibility states.
6. Continue by lowest ready work-package ID whose dependencies are satisfied.

PR #175 must be reconciled, split, or closed in favor of compatible work. Green CI alone does not make an incompatible product contract mergeable.

## 7. Hourly session protocol

Each scheduled session must:

1. read this plan, the current active-sprint record, open PRs, CI, and deployment state;
2. resume existing ready work before creating overlapping branches;
3. select every non-conflicting ready work package inside the active sprint;
4. implement, test, and document coherent changes;
5. open or update PRs with exact evidence;
6. merge only when required checks and the PR-specific gate pass;
7. deploy only to the authorized environment and verify the exact SHA;
8. update the active-sprint record with completed, blocked, next, and rollback state.

Concurrency is encouraged when files, contracts, and deployment targets do not overlap. When overlap exists, work is serialized or stacked explicitly.

## 8. Automatic stop conditions

The session must stop mutation and report a blocker when any of the following appears:

- unclear state ownership, scheduler target, deployment source, or migration direction;
- a secret or credential would need to be exposed;
- destructive or irreversible production data change;
- Live trading, real billing, or new financial authority;
- failing safety, trading, persistence, or lineage regression;
- deployed SHA cannot be proven;
- another active branch changes the same contract or protected runtime;
- requested behavior conflicts with this plan or an unexpired protected qualification boundary.

Stopping a risky mutation does not stop other independent, safe work packages in the same session.

## 9. Gate records and status

Sprint status is one of:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `GATE_REVIEW`
- `PASSED`
- `ROLLED_BACK`

Only evidence changes status. Calendar time, number of commits, deployment SUCCESS, or UI appearance alone cannot mark a sprint PASSED.

The active-sprint record must identify:

- current Sprint ID;
- ready work packages;
- active PRs/branches;
- completed acceptance criteria;
- unresolved blockers;
- validation and deployment evidence;
- next safe actions.

## 10. Beta exclusions

Not included in `v1.0.0-beta.1`:

- real-money trading;
- strategy marketplace, public uploads, or revenue sharing;
- community comments/follows;
- native mobile apps;
- arbitrary user code execution;
- full Enterprise implementation beyond entitlement/contact scaffolding;
- automatic promotion of a Challenger into financial authority;
- any claim that Paper performance proves future profitability.

## 11. Change control

Material changes to scope, sprint order, safety boundaries, plan semantics, or release gates require a dedicated plan PR. Implementation PRs may clarify task details but may not silently redefine this document.

After this plan merges, hourly development follows it until a later approved plan revision replaces it.
