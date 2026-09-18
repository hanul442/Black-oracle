# BLACK ORACLE Product Constitution v2

Status: PROPOSED CANONICAL BASELINE
Date: 2026-09-18
Supersedes for future product decisions: BLACK_ORACLE_PRODUCT_CONSTITUTION_V1.md
Scope: Product identity, Report/AutoTrade boundaries, investment authority, personalization, commercial semantics, system boundaries, UX principles, promotion governance

## 0. Constitutional hierarchy

This document is the product-level source of truth for the 2026-09-18 redesign.

When documents disagree, apply this precedence:

1. Product Constitution v2 — product identity, authority, safety, commercial invariants.
2. Master Sprint Plan v3 — implementation order, sprint gates, migration program.
3. Design System v2 — interaction and visual rules.
4. Implementation PRs — code-level realization of the above.
5. Legacy documents and mockups — historical evidence only unless explicitly re-adopted.

Runtime truth still outranks documentation claims about what is actually deployed or executing.

## 1. Product Definition

BLACK ORACLE is a mobile-first AI investment product built around two independent but interoperable modes: **AutoTrade** and **Report**.

Official definition:

> 증거에서 판단, 전략, 리스크, 실행, 결과까지 투자 의사결정을 검증·재현하고, 리서치와 자동 운용을 독립적으로 제공하는 AI 투자 운영체제.

**AutoTrade** is the execution-oriented investment engine. It configures and operates strategy portfolios according to investor profile, risk limits, horizon, return objective, intervention preference, current market constraints, and deterministic Risk.

**Report** is an independent research and market-intelligence service for markets, sectors, equities, crypto, and other supported assets. It may inform the user or be referenced inside an AutoTrade trace, but a Report is never an execution permit.

BLACK ORACLE is not a stock-tip application, a single-strategy bot, a decorative news dashboard, or a generic AI chat interface.

External product access, personalization, plans, Credits, and multi-user operation are now first-class product concerns, but the current execution boundary remains **PAPER-only** until separate live-capital gates are passed.

## 2. Primary Objectives

BLACK ORACLE optimizes for both absolute return and survival-aware, risk-adjusted performance.

The current one-month +10% / KRW 10M PAPER objective is an aspirational operating target. It is not, by itself, a promotion gate and must never override risk, robustness, calibration, or operational-integrity requirements.

Promotion quality is judged from a portfolio of evidence including:

- net return and expectancy
- drawdown and tail loss
- Sharpe / Sortino where sample quality permits
- profit factor and payoff asymmetry
- out-of-sample performance
- regime stability
- Monte Carlo survival
- parameter robustness
- calibration quality
- sample size and effective independence
- execution quality and slippage sensitivity
- operational stability and data quality

No single metric may compensate for a failed hard gate.

## 3. First-Class Decisions

The canonical decision set is:

- LONG
- SHORT
- NO_TRADE

NO_TRADE is a first-class investment decision, not a missing prediction or an error state. Its opportunity cost, avoided loss, false block rate, and calibration must be evaluated prospectively.

## 4. Canonical Decision Flow

BLACK ORACLE has two canonical product planes.

**AutoTrade decision plane**

Investor Profile / Mandate
→ Strategy Package / Risk Envelope
→ Market State
→ Execution-Grade Evidence Packet
→ Strategy Factory / Strategy Vault
→ Strategy Router
→ AI Council
→ Independent Red Team
→ Arbiter
→ Deterministic Risk
→ PAPER Execution
→ Order / Trade / Position / Protection
→ Outcome
→ Decision Replay / Calibration / Attribution
→ Champion–Challenger Learning

**Report research plane**

Market / Sector / Company / Asset
→ Research-Grade Data & Evidence
→ Research Pipeline
→ AI Analysis
→ Versioned Report
→ Archive / Compare / Reference

Both planes may share identity, instruments, source lineage, market data, and evidence provenance. They do **not** share execution authority.

Every material execution-side step must be connected through canonical lineage and recoverable from a trace identifier.

## 5. Authority Model

### 5.1 Deterministic Risk is sovereign

Council, models, strategies, or operator-facing AI explanations may never bypass deterministic portfolio and execution risk controls.

### 5.2 Council authority progresses by evidence

Council begins shadow-only. Authority may advance only through measured prospective performance:

SHADOW
→ REVIEWED ADVISORY
→ LIMITED VETO / SIZING AUTHORITY
→ CONDITIONALLY AUTHORIZED

Production execution authority is not granted by prompt confidence, majority voting, or a successful backtest.

### 5.3 Fail-closed incident policy

When data integrity, runtime state, model validity, or execution infrastructure is materially uncertain:

- new risk is blocked
- existing positions remain observable
- risk-reducing exits, stop-losses, take-profits, and emergency protection remain permitted
- no component may fabricate missing data to remain operational

## 6. Strategy Constitution

BLACK ORACLE uses a portfolio of strategies rather than one permanent master strategy.

The Strategy Factory may autonomously:

- generate candidates
- run backtests
- perform walk-forward / OOS validation
- stress-test candidates
- run Monte Carlo analysis
- register experiments
- admit qualified candidates into Challenger / Shadow research

It may not automatically promote a strategy to production Champion or increase real capital authority.

Strategy Router selects among eligible strategies using current market state, empirical strategy quality, conflict rules, capacity, and portfolio context. Regime is an auxiliary input to routing and validation, not an unquestionable master classifier.

## 7. Evidence Constitution

NARS is an internal Evidence Fabric producer for BLACK ORACLE.

Evidence is classified by intended authority.

- **Research-grade Evidence** may support Reports and exploratory analysis.
- **Execution-grade Evidence Packets** are evaluated under AutoTrade freshness, provenance, contradiction, policy, and trace requirements.

A Report or research-grade claim may be referenced by AutoTrade, but it does not inherit execution authority. AutoTrade must re-evaluate any execution-relevant claim under the current market state and current policy.

**Constitutional rule: reuse lineage, not authority.**

Evidence improves a decision's information set, provenance, explanation, and confidence, but Evidence is not an unconditional execution permit.

A trade may be considered without external/news Evidence when the governing Strategy Grade and all other Router, Council, Risk, portfolio, and execution gates are satisfied.

Therefore the legacy invariant:

> No Evidence → No New Risk

is not part of the target constitution.

Its removal must be implemented through an explicit versioned policy change with regression tests and before/after attribution. Existing PAPER qualification samples must not be silently mixed across materially different execution policies.

Evidence must still be:

- source-backed when claimed as factual
- timestamped
- provenance-aware
- contradiction-aware
- non-fabricated
- connected to decision lineage when used

## 8. Council Constitution

The approved direction is Council v3:

Core Team:

- Chief Market Strategist
- Evidence Intelligence Officer
- Quant & Model Validation Lead
- Trade Architect

Independent Red Team:

- Director of Adversarial Research

Dynamic specialists are activated only when their domain data is available and relevant.

Council must distinguish:

- FACT
- INFERENCE
- ASSUMPTION
- COUNTEREVIDENCE
- DATA_GAP

Majority voting, seniority weighting, and naive confidence averaging must not be the final decision mechanism. The Arbiter evaluates evidence quality, conflict, invalidation, missing data, and risk-relevant dissent.

## 9. Canonical Ledger and Decision Replay

Decision Replay is a core product capability.

The system must be able to answer, for any trade or NO_TRADE decision:

- what data was known at decision time
- what evidence was attached
- which strategies were eligible and rejected
- which strategy was selected and why
- what Council members independently concluded
- what the Red Team challenged
- what changed after debate
- what the Arbiter decided
- what deterministic Risk allowed
- what order was sent
- what fill occurred
- how the position was protected
- what outcome occurred
- whether the forecast was calibrated
- which component contributed positively or negatively

Canonical history is append-oriented. User interfaces consume read models / projections instead of requiring the entire operational checkpoint for every view.

## 10. Runtime Separation

The product must distinguish at least four different meanings of health:

1. Process / deployment liveness
2. Application readiness
3. Trading runtime health
4. Qualification / evidence validity

A failed database checkpoint query must not by itself make a healthy web process undeployable. Conversely, a Railway SUCCESS badge must never be interpreted as proof that scheduled trading cycles are healthy.

Runtime State, Canonical Event Ledger, read-optimized projections, and health telemetry must progressively be separated.

## 11. Promotion Gate

PAPER → real-capital promotion requires hard-gate evidence across:

- minimum valid sample
- OOS / walk-forward performance
- Monte Carlo survival
- drawdown compliance
- calibration
- execution realism
- data quality
- lineage completeness
- runtime / scheduler stability
- recovery behavior

Promotion remains blocked if a hard gate is unresolved even when headline return is high.

Real capital begins as canary capital and scales in stages only after further evidence.

## 12. Market Priority

Near-term **AutoTrade execution validation** prioritizes equities while preserving useful crypto PAPER infrastructure.

The **Report** product may cover markets, sectors, equities, crypto, and other supported assets on a broader 24/7 research schedule because research coverage does not itself expand execution authority.

Execution-market expansion remains evidence-driven and separately gated.

## 13. Product Surface Constitution

BLACK ORACLE is mobile-first.

### 13.1 Primary navigation

The approved top-level product navigation is:

- **Home**
- **Report**
- **AutoTrade**
- **Community**

Report and AutoTrade are first-class independent destinations. A fast **AutoTrade | Report** mode switch may also appear in the shared shell, but the UX must not imply that one is a prerequisite for the other.

Community may exist as a navigation destination before all social features are implemented, but unimplemented capabilities must be labeled with the repository status vocabulary and must not be simulated with fake activity.

### 13.2 Home

Home answers:

- What needs attention now?
- What changed in markets, Reports, AutoTrade, risk, or system health?
- Is any data stale, degraded, blocked, or unavailable?

### 13.3 Report

Report is a complete research product.

It should support, as contracts mature:

- market briefs,
- sector reports,
- equity reports,
- crypto reports,
- Flash / event-driven updates,
- version history,
- source and evidence inspection,
- counterevidence and invalidation,
- compare, archive, and reference flows.

Report must expose timestamp, freshness, version, source provenance, and limitations.

### 13.4 AutoTrade

AutoTrade shows:

- current investor mandate and editable constraints,
- eligible strategy package,
- strategy ranking and validation state,
- current PAPER authority mode,
- positions, orders, active risk, stops and protection,
- Router / Council / Arbiter / Risk summaries,
- Decision Replay and outcome attribution.

A user must be able to understand what AutoTrade is doing now, what it is allowed to do, and why.

### 13.5 Investor Profile

Investor Profile begins with onboarding and remains directly editable.

At minimum it models:

- risk tolerance,
- investment horizon,
- return objective,
- maximum loss / drawdown tolerance,
- intervention preference,
- permitted assets,
- liquidity / cash constraints where relevant,
- strategy and concentration limits where relevant.

Presets may accelerate setup, but every preset must expand to explicit editable values. Profile changes are versioned and must never silently increase execution authority.

### 13.6 Strategy Library

Strategy Library displays strategy identity and comparable evidence, including return and risk metrics only when the underlying sample and methodology are valid.

Backtest, Forward, and PAPER results must remain distinguishable. Missing or insufficient metrics are not converted to zero.

### 13.7 Visual direction

The default visual direction is premium fintech with institutional data discipline and consumer-grade clarity.

Deep financial entities open as dedicated full pages rather than being trapped in modal-heavy flows. Missing data, freshness, and authority status are visible rather than hidden behind decorative certainty.

## 14. Legacy Removal Policy

Legacy features do not survive merely because they already exist.

Case, Hypothesis, and Scenario-era product surfaces are not part of the target top-level product unless they are re-expressed as useful internal trading objects. Dead navigation, duplicated logs, mock data, obsolete Firebase-era product assumptions, and stale documentation should be retired deliberately.

Removal requires checking dependencies and migration impact; deletion must not destroy audit history.

## 15. Non-Fabrication Rule

BLACK ORACLE must never invent values merely to complete a visual or AI response.

If data is unavailable, the product shows unavailable / insufficient data / not yet calibrated.

This applies to:

- prices
- forecast distributions
- probability
- grades
- evidence
- Council inputs
- portfolio values
- historical outcomes
- performance metrics

## 16. Change Control

Any future change that materially alters one of the following requires an explicit versioned policy decision:

- Report / AutoTrade authority boundary
- execution eligibility
- risk limits
- position sizing
- Evidence authority
- Council authority
- strategy promotion
- investor-profile semantics
- qualification sample semantics
- plan / Credit entitlement semantics
- real-capital authority

Historical qualification data must not be silently combined across incompatible policies.

## 17. Commercial Constitution

BLACK ORACLE separates **Plan**, **Capacity**, **Credits**, and **Profile**.

### 17.1 Plans

The approved plan ladder is:

**Core → Plus → Pro → Max → Enterprise**

Plans define entitlement and product-access boundaries.

### 17.2 Capacity multipliers

**Pro ×2 / ×5 / ×20** expand eligible Pro capacity / compute / usage. They do **not** become hidden feature tiers and do not unlock Max-only or Enterprise-only capabilities.

### 17.3 Workload profiles

**Balanced / Strategy / Research** are workload or compute presets. They tune how eligible resources are allocated; they do not silently change the user's plan, total entitlement, financial authority, or historical truth.

### 17.4 Credits

Credits may meter expensive AI, research, simulation, strategy, or generation work where defined.

Credit exhaustion must never hide, lock, or degrade access to safety-critical or truth-critical state, including:

- positions,
- risk,
- stops,
- protection,
- Decision Replay,
- audit history,
- freshness / degraded status,
- critical alerts.

Ordinary navigation and the minimum information needed to understand active exposure must not become unsafe because a Credit balance is low.

### 17.5 Billing stage

During Beta, billing and Credit settlement are test-only unless a separate commercial-release decision explicitly authorizes real charging.

## 18. Product Status Vocabulary

Project documentation and product claims use only these lifecycle labels:

- **DESIGN**
- **PLANNED**
- **IMPLEMENTED**
- **DEPLOYED**
- **VERIFIED**
- **BLOCKED**
- **DEPRECATED**
- **ARCHIVED**

A screen, PR, deployment badge, or mockup does not promote a capability to VERIFIED. Evidence is required.

## 19. PAPER and Future Live Boundary

Current AutoTrade authority is **PAPER-only**.

Future live-capital capability is a separate program and requires, at minimum:

- broker/account isolation,
- order and position reconciliation,
- credential and permission controls,
- compliance / jurisdiction review where applicable,
- real-execution incident handling,
- canary capital stages,
- explicit rollback / kill conditions,
- validation that live/PAPER divergence is understood.

No README, UI, plan tier, Credit multiplier, or model confidence may imply live authority before those gates pass.

## 20. Report / AutoTrade Separation Test

A compliant implementation must satisfy all of the following:

1. Report can operate without AutoTrade.
2. AutoTrade can operate without a completed Report.
3. A Report cannot place, approve, or silently strengthen an order.
4. AutoTrade may reference Report lineage but must re-evaluate execution-relevant claims under current conditions.
5. Shared data infrastructure does not erase authority boundaries.
6. Product analytics may measure cross-use without converting correlation into trading authority.

---

This constitution is the product-level source of truth for the redesign. Implementation details may evolve, but a Sprint that violates these invariants must either be corrected or explicitly amend this document through a versioned policy decision before promotion.