# BLACK ORACLE Master Plan v2

Status: APPROVED EXECUTION PLAN
Date: 2026-09-11
Depends on: BLACK_ORACLE_PRODUCT_CONSTITUTION_V1.md

## Executive Target

The target is not to add the largest number of features. The target is to turn the existing fast-moving prototype and PAPER engine into a coherent, auditable, failure-tolerant autonomous investment operating system.

The program advances only when the current layer produces evidence sufficient for the next authority level.

## Current Baseline

Current main already contains major pieces of the target system:

- Strategy Router
- autonomous Strategy Factory
- deterministic Risk / execution policy
- Council v3 constitution
- independent Red Team and Arbiter logic
- Canonical Event Ledger
- NARS consumer / Evidence projections
- Decision Replay
- forecast/outcome calibration primitives
- Monte Carlo utilities
- crypto PAPER loop
- KRX equity PAPER path
- mobile V6 Oracle / Decision / Replay / Outcome surface

The principal problem is no longer feature absence. It is integration debt, runtime integrity, policy drift, stale legacy product surfaces, and insufficiently separated operational state.

## Program Rules

1. Preserve the current S1R2 qualification sample until an explicit qualification reset/version boundary is approved.
2. Never silently change strategy, sizing, risk, or execution semantics inside an existing qualification cohort.
3. New authority begins in Shadow.
4. Railway deployment status and actual trading-runtime health are measured separately.
5. Missing data is displayed as missing, never synthesized for presentation.
6. Every high-impact decision becomes replayable through canonical lineage.
7. Promotion is evidence-gated, never automatic.
8. Legacy retirement is explicit, dependency-checked, and non-destructive to audit history.

---

# S0 — Runtime Integrity

## Objective

Make the platform operationally trustworthy before adding further investment intelligence.

## S0.1 Deployment liveness separation

Problem:
The web service deployment healthcheck was coupled to a full Supabase trading checkpoint read. A database timeout could therefore make an otherwise-started web deployment fail.

Target:

- process/deployment liveness performs no heavy external I/O
- application/trading health remains separately observable
- a DB degradation is visible as DEGRADED rather than masquerading as process death

Exit gate:

- black-oracle-web deploys successfully with liveness independent of checkpoint JSONB reads
- authenticated trading runtime health still exposes persistence faults

## S0.2 PAPER checkpoint pressure

Problem:
Qualification checkpoints contain large execution state plus a deep ledger and have produced PostgREST statement/header timeouts.

Target analysis:

- measure serialized and compressed checkpoint size by component
- attribute write/read latency to ledger, closed trades, evidence, portfolio curve, and metadata
- preserve qualification semantics while removing unnecessary checkpoint payload pressure

Preferred target architecture:

- compact mutable runtime snapshot for recovery
- canonical append-only event history for audit/replay
- read projections for UI/query

Do not reduce qualification history solely to make the error disappear until qualification invariants are proven.

Exit gate:

- scheduled PAPER cycles complete reliably
- checkpoint reads/writes remain within defined latency budget
- no lost portfolio/order/protection state across restart
- qualification evidence remains comparable

## S0.3 Recovery and fault injection

Test:

- DB temporary timeout
- scheduler duplicate invocation
- process restart during cycle
- stale lease
- event append failure
- checkpoint save failure
- NARS unavailable
- AI Council unavailable

Expected behavior:

new risk fails closed; existing protective exits remain possible where execution infrastructure permits.

## S0 Deliverable

A Runtime Integrity dashboard/read model showing independently:

- Deployment
- Gateway
- Runtime
- Persistence
- Scheduler
- Ledger
- Market data
- NARS
- AI Council
- Qualification

No single green badge may hide a degraded subsystem.

---

# S1 — Canonical Architecture

## Objective

Turn the current collection of working modules into a single canonical system model.

## S1.1 Canonical entities

Standardize identifiers and schemas for:

- Instrument
- Market Snapshot
- Evidence Packet
- Strategy / Strategy Version
- Strategy Experiment
- Router Decision
- Council Session
- Red Team Challenge
- Arbiter Decision
- Risk Decision
- Order
- Fill
- Position
- Protection Revision
- Outcome
- Calibration Observation
- Runtime Incident

## S1.2 Trace contract

Every investment decision receives stable lineage:

trace_id
→ market state
→ evidence
→ strategy candidates
→ selected strategy
→ Council rounds
→ Red Team
→ Arbiter
→ Risk
→ order/fill
→ protection
→ outcome
→ calibration

Fallback inference is clearly labeled and progressively eliminated.

## S1.3 State separation

Separate:

- Recovery State
- Canonical Event History
- Read Models
- Research Experiment Ledger
- Qualification Cohorts

## Exit gate

A completed or rejected decision can be reconstructed without reading an opaque monolithic runtime checkpoint.

---

# S2 — Decision Engine Completion

## Objective

Make the pre-trade chain explicit, measurable, and internally consistent.

Canonical path:

Strategy Candidates
→ Router
→ Council Round 0
→ Independent Red Team
→ Revisions
→ Arbiter
→ Deterministic Risk
→ Execution

## S2.1 Router

Router must record:

- eligible strategies
- rejected strategies and reasons
- current market/regime features used
- empirical grade
- capacity/conflict constraints
- selected strategy or NO_TRADE

## S2.2 Council v3 operationalization

Provide real packets to roles rather than prose-only context:

- technical structure
- multi-timeframe cycle
- microstructure / flow
- Evidence and contradiction
- Strategy validation packet
- trade map
- portfolio context
- risk envelope

Absent data remains DATA_GAP.

## S2.3 Council prospective evaluation

Measure:

- Round 0 accuracy/calibration
- post-debate change
- Red Team invalidations
- false blocks
- avoided losses
- Council disagreement
- incremental value versus deterministic baseline

## Exit gate

Council remains Shadow until prospective evidence shows incremental value. No authority promotion merely because the UI looks complete.

---

# S3 — Strategy Intelligence

## Objective

Build a disciplined internal market for strategies.

Lifecycle:

IDEA
→ CANDIDATE
→ TESTED
→ REJECTED or CHALLENGER
→ SHADOW
→ CHAMPION_CANDIDATE
→ HUMAN/POLICY PROMOTION REVIEW
→ CHAMPION
→ DEGRADE / RETIRE

## S3.1 Grade System

Use the approved credit-style vocabulary:

AAA+, AAA, AAA-
AA+, AA, AA-
A+, A, A-
BBB
BB
B
CCC
CC
C
D+, D, D-
F+, F, F-

Grade is composite and hard-gated. It is never a cosmetic conversion of win rate.

Inputs include as available:

- OOS / walk-forward performance
- expectancy
- payoff ratio
- MDD
- Sharpe / Sortino
- Monte Carlo survival
- regime stability
- parameter robustness
- sample size
- data quality
- reproducibility
- execution sensitivity
- operational risk

## S3.2 Strategy Router integration

Strategy grades inform eligibility but do not directly authorize execution. Router, Council, Risk, and portfolio constraints remain independent gates.

## S3.3 Evidence policy migration

Target policy permits a sufficiently qualified strategy to be considered even without external Evidence.

Implementation requirements:

- version execution policy
- write regression tests
- preserve old cohort identity
- compare Evidence-backed and non-Evidence decisions prospectively
- never reinterpret historical trades as if the new policy had existed

## Exit gate

The strategy system can explain why a candidate was generated, rejected, shadowed, promoted, degraded, or retired.

---

# S4 — Decision Replay, Attribution, and Learning

## Objective

Turn outcomes into learning without retrospective fabrication.

## S4.1 Replay

One interaction reconstructs the decision timeline from information available at the time.

## S4.2 Calibration

Where sample quality permits, measure:

- Brier score
- directional accuracy
- probability bucket reliability
- realized-return distributions
- holding-period distributions
- confidence calibration

Quantiles remain hidden below explicit sample gates.

## S4.3 Attribution

Evaluate incremental contribution from:

- strategy selection
- Evidence
- Council
- Red Team
- Arbiter
- sizing
- entry timing
- protection / exit

Correlation and counterfactual diagnostics must not be labeled causal without a valid design.

## S4.4 NO_TRADE attribution

Track prospective NO_TRADE outcomes to estimate:

- avoided loss
- missed gain
- opportunity cost
- false block rate

## Exit gate

BLACK ORACLE can explain not only whether it made money, but which layer added or destroyed value.

---

# S5 — High-End Product Surface

## Objective

Make the system understandable at a glance without hiding institutional depth.

Design direction:

Bloomberg discipline × Apple clarity
Light Primary
Mobile-centric
Data-first, non-cinematic by default

## Information Architecture

### Home

System summary:

- portfolio/equity
- active risk
- current decisions
- market state
- important system degradation
- recent meaningful activity

### Market

- search / universe
- TradingView-level OHLCV interaction
- higher timeframes
- technical state
- strategy state
- Evidence markers
- decision/entry/exit overlays where recorded

### Trade

- current proposed/active trade
- strategy and grade
- Council/Arbiter summary
- risk/sizing
- entry/SL/TP map
- PAPER execution controls/status

### Log

Two projections:

1. Trading / Decision Log
2. System / Technical Log

Both support trace drill-down.

### More

- Strategy Vault / Factory
- Council detail
- System health
- NARS / Evidence
- qualification
- settings

## Product cleanup

Retire or absorb:

- Cases top-level UX
- Hypothesis top-level UX
- Scenario top-level UX
- duplicated Ledger/Log surfaces
- mock data in production surfaces
- obsolete Firebase-era architecture claims
- redundant mobile V2–V5 entry paths after migration confidence

Do not delete audit data merely because a UI surface is retired.

## Performance gate

- mobile initial bundle budget defined and monitored
- large desktop/Firebase dependencies do not block mobile first render
- expensive views lazy load
- loading/error/empty/degraded states are explicit

---

# S6 — PAPER Qualification

## Objective

Prove that the complete system works prospectively under realistic operating conditions.

Qualification scorecard includes:

Performance:
- net return
- expectancy
- win rate
- payoff ratio
- profit factor

Risk:
- MDD
- daily loss
- tail events
- exposure
- concentration

Validation:
- valid sample size
- OOS evidence
- Monte Carlo
- calibration
- strategy stability

Operations:
- scheduler reliability
- checkpoint/recovery reliability
- data freshness
- ledger completeness
- trace completeness
- incidents

The monthly +10% objective is reported but cannot compensate for hard-gate failures.

## Exit gate

Promotion packet is complete and every hard gate is explicitly PASS. Any unresolved BLOCKED state prevents live authority.

---

# S7 — Canary Live

## Objective

Introduce real capital without converting PAPER confidence directly into full capital exposure.

Stages:

CANARY-0: credentials / broker integration with no autonomous new risk
CANARY-1: minimum capital, strict caps
CANARY-2: limited strategy set
CANARY-3: measured scale-up
PRODUCTION: only after live execution evidence

Each stage has rollback criteria.

Real-capital scaling depends on:

- live slippage
- fill quality
- live/PAPER divergence
- realized drawdown
- runtime reliability
- incident rate
- calibration persistence

## Kill / Rollback Conditions

Examples:

- unexplained order duplication
- broken lineage
- stale market data used for new risk
- risk limit breach
- persistent broker mismatch
- recovery inconsistency
- material model/data drift

Risk-reducing actions remain prioritized during degradation.

---

# Final Product State

A mature BLACK ORACLE session should make this chain visible and inspectable:

MARKET
→ EVIDENCE
→ STRATEGIES COMPETE
→ ROUTER SELECTS
→ COUNCIL CHALLENGES
→ ARBITER DECIDES
→ RISK CONSTRAINS
→ EXECUTION ACTS
→ OUTCOME RESOLVES
→ CALIBRATION SCORES
→ STRATEGIES LEARN

The operator should be able to move from a portfolio-level overview to the exact evidence and decision lineage behind a single fill without encountering conflicting versions of truth.

## Definition of Done

BLACK ORACLE is not considered complete because every planned screen exists. It is complete when:

1. runtime state survives real faults predictably
2. new risk fails closed under uncertainty
3. all material decisions are traceable
4. strategies compete under reproducible validation
5. Council has empirically demonstrated value before gaining authority
6. performance and risk are attributable
7. PAPER qualification is prospectively passed
8. real capital is introduced by canary stages
9. UI exposes the true system state without fabricated values
10. legacy product concepts no longer obscure the investment operating model
