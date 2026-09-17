# BLACK ORACLE Product Constitution v2

Status: BETA 1.0 PRODUCT SOURCE OF TRUTH
Date: 2026-09-18
Supersedes: Product-facing definitions in `BLACK_ORACLE_PRODUCT_CONSTITUTION_V1.md`
Preserves: V1 safety, auditability, qualification, risk, lineage, and authority invariants unless explicitly amended below.

## 1. Product Definition

BLACK ORACLE Beta 1.0 is an **AI Investment Research & Automated Trading Platform** built on top of an auditable autonomous investment operating system.

The product has two primary commercial pillars and one supporting network layer:

1. **REPORT** — discover, search, understand, and monitor investment opportunities.
2. **AUTOTRADE** — build, validate, rank, modify, and run investment strategies.
3. **COMMUNITY** — share research and strategies, discuss results, and fork validated strategy objects.

The product-facing promise is intentionally simpler than the internal architecture.

> **Research opportunities. Build and rank strategies. Turn validated decisions into automated trades.**

Internally, BLACK ORACLE preserves the deeper operating model:

> Evidence → Discovery → Report → Council → Decision → Strategy → Risk → Execution → Outcome → Learning

The user should not need to understand Router, Arbiter, event-ledger, Red Team, or checkpoint internals to use the product safely.

---

## 2. Product Boundary

### 2.1 REPORT answers

- What is worth looking at now?
- Why is this sector, stock, or crypto asset interesting?
- What evidence supports or contradicts the thesis?
- What do the Council members think?
- What are the expected scenarios, entry zone, stop, targets, and invalidation conditions?

### 2.2 AUTOTRADE answers

- Which strategies are strongest right now?
- How were they validated?
- Can I run, modify, fork, or compare them?
- How much risk should they receive?
- What positions and trades are they currently producing?
- How did each strategy perform after costs, drawdowns, OOS validation, and Monte Carlo testing?

### 2.3 COMMUNITY answers

- Which reports and strategies are gaining attention?
- What are other users researching or testing?
- Which strategies were forked, modified, and improved?
- What experiments and discussions are attached to a report or strategy?

Community is a supporting product layer, not a generic social network.

---

## 3. Primary Navigation

The default Beta 1.0 product navigation is:

- **Home**
- **Report**
- **AutoTrade**
- **Community**

Profile, billing, connections, credits, security, and settings remain secondary navigation.

Internal operational concepts must not become top-level navigation merely because they exist in the backend.

---

## 4. Home

Home is a command summary for normal users, not an engineering console.

It should answer within seconds:

- What is the market regime?
- What are the top opportunities?
- What is my Paper portfolio doing?
- Which strategies are running?
- What important reports, trades, or alerts changed recently?

Runtime faults that materially affect user trust may be surfaced as concise warnings, while detailed system diagnostics remain an operator/admin concern.

---

## 5. REPORT Constitution

REPORT is the investment-intelligence product surface.

### 5.1 Core capabilities

- sector/theme discovery
- stock and crypto discovery
- instrument search
- recent reports
- watchlist reports
- event-driven report updates
- visual technical analysis
- evidence-backed thesis
- Council deliberation
- scenario forecasts
- trade-plan presentation
- report history and forecast accountability

### 5.2 Report structure

A qualified report should be able to present:

- asset and market context
- Oracle grade
- current price
- direction or `NO_TRADE`
- entry zone
- stop / invalidation
- targets
- expected price or range
- expected horizon
- risk level
- Bull / Base / Bear scenarios
- evidence and contradictions
- visual chart annotations
- Council result and disagreement
- update/version history

Missing data must remain explicitly missing.

### 5.3 Visual analysis

Technical analysis must be inspectable on the chart rather than existing only as prose.

Supported analytical layers may include:

- trend
- support/resistance
- supply/demand
- entry / stop / targets
- volume profile
- momentum
- Elliott Wave where applicable
- flow/microstructure
- forecast cone

AI explanations should point to the relevant visual area where technically practical.

### 5.4 Immutable forecasts

Published forecasts and trade plans are immutable historical claims.

New information creates a new report version or update. The platform must not overwrite a failed historical forecast as though the new view had existed earlier.

### 5.5 REPORT → AUTOTRADE

A Report may expose **Use in AutoTrade**.

This action must reuse the existing decision lineage rather than restarting research from scratch.

The handoff should preserve, where available:

- Report ID / version
- Evidence lineage
- Council session
- forecast
- trade map
- invalidation conditions
- candidate strategies

Report and AutoTrade are separate product experiences backed by one canonical decision graph.

---

## 6. Oracle Intelligence

NARS evolves from a news-oriented producer into the internal **Oracle Intelligence** evidence layer.

The architecture should support extensible ingestion of:

- news
- filings
- market data
- research
- macro data
- on-chain data
- PDFs / CSVs
- APIs
- databases
- custom scrapers/connectors
- future enterprise-private sources

The core unit is an evidence object with provenance, entity relationships, timestamps, reliability, relevance, contradictions, and lineage.

Enterprise extensions should reuse the same evidence model while adding tenant isolation and permissions.

---

## 7. Discovery Constitution

Discovery runs continuously and may use multiple independent paths:

- macro → sector → theme → asset
- event → asset
- technical → asset
- flow → asset
- sentiment → asset
- on-chain → crypto
- bottom-up anomaly → sector/theme rediscovery

Candidates are not automatically promoted to expensive full reports.

Target flow:

> Discovery → Candidate → Qualification Gate → Light Council → Full Report

Rejected candidates remain observable internally for later calibration and false-negative analysis.

---

## 8. Council Constitution v2

Council remains a real decision layer, not decorative personas.

### 8.1 Product-facing structure

Use five stable analytical seats plus one dynamic specialist seat where appropriate.

Representative roles:

1. Macro / Regime
2. Fundamental / Thesis
3. Quant / Statistical
4. Technical / Structure
5. Risk / Portfolio
6. Dynamic Specialist

The legacy Red Team and Arbiter functions may remain internally as challenge/synthesis mechanisms without requiring separate top-level product surfaces.

### 8.2 Independence and debate

Initial opinions should be independently persisted before agents see each other's conclusions.

Then use structured challenge, evidence re-check, and weighted final decision.

### 8.3 Specialist monetization

Users may invite specialized experts such as:

- on-chain
- microstructure
- options
- earnings
- Elliott Wave
- Korean institutional flow

A specialist may join analysis, debate, and vote. Paid invocation is controlled through plan entitlements or Oracle Credits.

### 8.4 Risk sovereignty

Council cannot bypass deterministic Risk.

Hard-risk conditions remain fail-closed.

---

## 9. AUTOTRADE Constitution

AutoTrade is a strategy-and-execution platform rather than a single automated trading bot.

Primary product surfaces:

- Strategy Rank
- Strategies
- Strategy Builder
- AI Strategy Factory / Incubator
- Marketplace
- Paper Portfolio
- Positions
- Trades
- Decision Replay

Beta 1.0 remains **PAPER ONLY**.

Future authority path remains:

> Advisory → Shadow → Paper → Small Live → Full Live

Live authority is never unlocked simply by purchasing a higher subscription tier.

---

## 10. Strategy Rank

Official, AI-generated, user-created, and forked strategies compete under the same validation framework.

Rankings must not be simple return leaderboards.

Where sample quality permits, grading considers:

- net return
- expectancy
- payoff ratio
- Sharpe / Sortino
- max drawdown
- OOS / walk-forward performance
- Monte Carlo survival
- regime stability
- parameter robustness
- transaction cost sensitivity
- execution robustness
- sample quality
- operational reliability

BLACK ORACLE's AAA-to-F grade vocabulary remains composite and hard-gated.

---

## 11. Strategy Creation, Forking, and Modification

Users may create or modify strategies through:

- natural language
- visual rule builder
- advanced code/DSL
- fork/remix of an existing strategy

A natural-language request must first become an inspectable structured strategy specification before testing or execution.

Forks must preserve lineage to their parent strategy.

Example:

> Oracle Momentum v14 → Hanseo Momentum v1 → Hanseo Momentum v2

The original and forks can compete independently after validation.

---

## 12. Strategy Qualification

No strategy moves directly from generation or editing into authority.

Target validation pipeline:

> Syntax/Data Integrity → Backtest → Cost/Slippage → Walk Forward → OOS → Monte Carlo → Regime Stress → Shadow → Paper

Hard-gate failure blocks promotion.

AI may generate, mutate, and test strategies autonomously, but production promotion initially requires explicit human/policy review.

---

## 13. Marketplace Constitution

Beta 1.0 Marketplace is primarily a **validated strategy discovery layer**.

Beta capabilities may include:

- publish
- discover
- rank
- save/follow
- compare
- Paper Run
- fork
- modify

Paid strategy sales, creator subscriptions, revenue share, and marketplace fees are architected for later phases but should not become a Beta 1.0 dependency.

This sequencing avoids premature complexity around misleading performance claims, payments, refunds, manipulation, and seller governance.

---

## 14. Community Constitution

Beta Community stays intentionally thin.

Preferred content objects:

- strategies
- reports
- experiments
- fork activity
- attached discussions/comments
- creator profiles

Community should amplify validated research and strategy development rather than become an unstructured stock-message board.

A broader market discussion layer may exist, but strategy/report objects remain the product differentiator.

---

## 15. Decision Lineage

The existing audit architecture remains a core moat.

Every material trade should remain traceable through a canonical relationship such as:

> Evidence → Discovery → Report → Council → Strategy → Risk → Order → Trade → Outcome

AutoTrade and Report consume the same canonical lineage.

Decision Replay remains a core capability but is productized inside Report history and Trade detail instead of requiring a standalone top-level destination.

---

## 16. Runtime and Truth Invariants

The following V1 principles remain unchanged:

1. Missing data is never fabricated.
2. New risk fails closed under material uncertainty.
3. Deterministic Risk remains sovereign.
4. Historical decisions are not retrospectively rewritten.
5. New authority begins in Shadow.
6. Qualification cohorts are not silently mixed across materially different policies.
7. Recovery state, canonical history, read models, and research experiments should remain logically separated.
8. Deployment health is not equivalent to trading-runtime health.

---

## 17. Productization of Existing Engine

Beta 1.0 is not a ground-up replacement of the existing engine.

The target migration principle is:

> **Preserve engine truth. Replace product language. Add missing commercial layers.**

Existing canonical systems should be reused where reliable rather than duplicated to match a new UI.

---

## 18. Commercial Model

Plans:

- Oracle
- Oracle+
- Oracle Pro
- Oracle Enterprise

Commercial architecture uses subscription entitlements plus Oracle Credits for expensive workloads such as specialist analysis, deep Council reruns, large simulations, and heavy research jobs.

Initial working pricing hypotheses remain subject to measured Beta COGS:

- Oracle: KRW 24,900 / month
- Oracle+: KRW 79,000 / month
- Oracle Pro: KRW 249,000 / month
- Oracle Enterprise: from approximately KRW 1,490,000 / month plus seats/data/compute

Direct variable cost × 1.5 is a minimum pricing floor, not a guaranteed final selling price.

The platform should measure real per-user AI, compute, data, and storage cost during Beta.

---

## 19. Beta 1.0 Scope

### Must be productized

- Report discovery/search/recent flow
- visual report detail
- Council interaction
- Report → AutoTrade handoff
- Strategy Rank
- strategy detail and validation
- strategy builder/fork/modify
- Paper AutoTrade
- portfolio/positions/trade detail
- Decision Replay integration
- lightweight Marketplace
- lightweight Community
- canonical lineage
- entitlement/credit-ready architecture

### Preserve from existing engine

- PAPER runtime and historical sample integrity
- Strategy Factory concepts
- Router
- deterministic Risk
- Council/Red Team/Arbiter logic where useful
- NARS/Evidence ingestion
- Canonical Event Ledger
- Decision Replay
- Monte Carlo and OOS validation
- grade system
- runtime integrity protections

### Post-Beta

- paid strategy marketplace transactions
- creator revenue share
- broad social/community mechanics
- real-money autonomous execution
- broad enterprise deployments

---

## 20. UI Principle

The visual target is **premium consumer fintech with institutional truth discipline**.

Primary characteristics:

- mobile-first
- medium information density
- progressive disclosure
- chart-centered visual analysis
- full-screen drill-downs instead of cramped modal-heavy workflows
- calm financial design
- meaningful motion only

Internal engine terminology should appear only when it helps an advanced user understand or audit a decision.

---

## 21. Change Control

Any change to the following still requires an explicit versioned policy decision:

- execution eligibility
- strategy promotion
- risk limits
- position sizing
- Evidence authority
- Council authority
- qualification semantics
- real-capital authority

Product navigation or naming changes do not implicitly authorize backend behavioral changes.

---

## 22. Final Product Model

A mature BLACK ORACLE experience should feel simple at the surface while preserving institutional depth underneath:

> **REPORT discovers and explains.**
>
> **AUTOTRADE validates and executes.**
>
> **COMMUNITY distributes and evolves research and strategies.**
>
> **The operating system underneath makes every material decision auditable.**
