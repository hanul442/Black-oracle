# BLACK ORACLE Beta 1.0 — Product Requirements Document

Status: DRAFT FOR IMPLEMENTATION
Date: 2026-09-18
Source of truth: BLACK_ORACLE_PRODUCT_CONSTITUTION_V2.md
Migration reference: BETA_1_0_MIGRATION_MAP.md

## 1. Executive Summary

BLACK ORACLE Beta 1.0 is an **AI Investment Research & Automated Trading Platform** built on top of the existing auditable investment-engine architecture.

The product is organized around two primary pillars and one supporting network layer:

1. **Report** — discover, search, understand and monitor investment opportunities.
2. **AutoTrade** — discover, build, validate, rank, fork, modify and run trading strategies.
3. **Community** — a lightweight network around reports, strategies, experiments and forks.

The backend remains one canonical decision system rather than separate Report and AutoTrade products.

Canonical flow:

`Evidence → Intelligence → Discovery → Report → Council → Structured Decision → Strategy → Risk → Paper Execution → Outcome → Learning`

Beta 1.0 is **PAPER ONLY**. Live execution must remain architecturally possible but cannot receive production authority in this release.

---

## 2. Product Positioning

### Product statement

BLACK ORACLE helps users discover promising market opportunities, understand why they matter through evidence-backed AI research, and turn validated investment strategies into automated paper trading systems.

### Core differentiation

BLACK ORACLE is not a stock-tip app, generic AI chat interface, basic news dashboard or single-strategy trading bot.

Its defensible system is the connection between:

- evidence provenance,
- continuous discovery,
- interactive visual reports,
- AI Council deliberation,
- strategy validation,
- deterministic risk,
- execution lineage,
- outcome attribution,
- and strategy evolution.

### Beta design principle

**Simple product surface, deep internal engine.**

Users should understand the product through tasks and outcomes. Internal engine concepts such as Router, Arbiter, canonical event projections and model-governance state should remain available in drill-down or operator tooling, not dominate primary navigation.

---

## 3. Target Users and Jobs To Be Done

### Persona A — Research Investor

Needs to answer:
- What sectors, stocks or crypto assets are becoming attractive?
- Why now?
- What evidence supports the thesis?
- What is the expected range, entry zone, stop and target?
- What do different AI experts disagree about?

Primary surface: Report.

### Persona B — Active / Systematic Investor

Needs to answer:
- Which strategies are working now?
- Which strategies fit the current regime?
- Can I run a validated strategy in Paper?
- Can I modify a strategy safely?
- Why did a trade happen and what caused the result?

Primary surface: AutoTrade.

### Persona C — Strategy Creator

Needs to answer:
- Can I describe a strategy in natural language?
- Can I fork and modify an existing strategy?
- Can I compare my strategy with AI and community strategies?
- Can I prove performance with OOS and Monte Carlo evidence?

Primary surface: AutoTrade + Community.

### Persona D — Future Enterprise Customer

Needs to answer:
- Can the same intelligence pipeline ingest proprietary documents and APIs?
- Can private evidence and reports remain tenant-isolated?
- Can the organization build private Council / research workflows?

Primary surface: future Oracle Enterprise.

---

## 4. Scope

### 4.1 Must exist in Beta 1.0

- Home
- Report discovery feed
- asset / sector / theme search
- recent reports
- watchlist
- Oracle Intelligence integration
- universal Evidence Object
- multi-path discovery
- qualification gate
- interactive Oracle Report
- visual technical-analysis layers
- forecast scenarios
- AI Council with 5 fixed + 1 dynamic seat
- specialist invitation framework
- immutable report versioning
- `Use in AutoTrade`
- Strategy Rank
- official / AI / user / fork strategy origins
- strategy detail and scorecard
- natural-language strategy creation
- visual strategy builder contract
- advanced strategy-spec / code path
- backtest
- walk-forward / OOS
- Monte Carlo
- hard qualification gates
- paper strategy runtime
- portfolio / positions / orders / history
- Decision Replay
- strategy fork / modify / compare
- Marketplace discovery without paid sales
- lightweight Community
- subscription / entitlement architecture
- Oracle Credits architecture
- user-level cost accounting
- mobile-first UX
- explicit degraded / stale / unavailable states

### 4.2 Architect now, enable later

- broker/exchange live execution
- Small Live / Full Live
- automated live strategy promotion
- paid Marketplace strategy sales
- creator revenue share
- enterprise private connector marketplace

### 4.3 Non-goals for Beta 1.0

- full social-network feature set
- generic stock message boards
- user-to-user direct messaging
- real-money autonomous trading
- strategy auto-promotion to live capital
- unbounded AI expert calls
- expensive institutional data redistribution without licensing validation

---

## 5. Primary Navigation

Mobile-first navigation:

1. **Home**
2. **Report**
3. **AutoTrade**
4. **Community**

Profile / Settings is accessed from the top-level account affordance.

### Home purpose

Answer in under 10 seconds:
- What is happening now?
- What should I look at?
- How is my Paper portfolio doing?
- Which strategies are running?
- What changed recently?

### Report purpose

Answer:
- What should I consider?
- Why?
- What evidence supports it?
- What is the expected trade map?

### AutoTrade purpose

Answer:
- Which strategies are strongest?
- What is currently running?
- Can I build, fork, modify or compare one?
- How is strategy performance affecting the portfolio?

### Community purpose

Answer:
- What are people researching?
- Which strategies are trending?
- What forks and experiments are emerging?

---

## 6. Home Requirements

### Required modules

- Market Regime summary
- Top Opportunities
- Recent / Updated Reports
- Paper Portfolio summary
- Active Strategies
- Alerts
- Important Oracle Activity
- selected Trending Community content

### Acceptance criteria

- Home must not require internal engine terminology to understand current state.
- If portfolio data is stale or unavailable, the UI must display the degraded state explicitly.
- Top Opportunities must link directly to their Report.
- Active Strategies must link directly to Strategy detail or running Paper session.
- Alerts must distinguish market opportunity alerts from system-health alerts.

---

## 7. Report Product

### 7.1 Report discovery

Primary sections:
- Discover
- Search
- Recent
- Watchlist

Filters:
- KRX
- US Equity
- Crypto
- Sector
- Theme
- grade
- report state

Report states:
- Candidate
- Qualified
- Active
- Updated
- Invalidated
- Resolved

### 7.2 Candidate card

A Candidate is a low-cost opportunity representation that has not yet passed full qualification.

Required fields where available:
- asset
- opportunity score
- preliminary grade
- discovery source/path
- qualification progress
- missing conditions
- current state

A Candidate must never look identical to a qualified Report.

### 7.3 Qualification gate

The default gate is strict.

Possible rejection reasons:
- insufficient evidence
- low expected value
- poor liquidity
- unacceptable risk/reward
- insufficient strategy fit
- high contradiction
- weak model agreement
- data integrity failure
- inadequate sample / context

Rejected candidates remain stored with their reason and later outcome where measurable.

### 7.4 Oracle Report — top section

The first screen must provide:
- asset
- current price
- direction
- Oracle grade
- entry zone
- expected price
- stop
- TP1 / TP2 / TP3 where applicable
- expected return
- risk level
- horizon
- Council vote summary
- 3–6 `Why Now` reasons
- `Use in AutoTrade`

The user should understand the core thesis within approximately 10–15 seconds.

### 7.5 Forecast

Required:
- Bull scenario
- Base scenario
- Bear scenario
- probabilities where supported
- expected path / forecast cone where supported
- explicit uncertainty

Forecast publication is immutable. New information creates a new Report version or update.

### 7.6 Visual analysis

The chart is an analytical surface, not decoration.

Selectable layers should support, where data is available:
- trend
- entry / SL / TP
- support / resistance
- supply / demand
- Elliott Wave
- volume profile
- momentum
- flow
- breakout
- forecast cone

Interaction requirement:
- where feasible, selecting an explanatory statement should highlight the corresponding chart region.

### 7.7 Evidence section

Evidence cards should contain:
- source
- event / claim
- timestamp
- freshness
- reliability
- direction / impact where applicable
- related assets / sectors
- contradiction flag

Higher plans expose deeper lineage and raw-source detail where legally allowed.

### 7.8 Report updates

A Report may receive updates, but the original state cannot be rewritten.

Each update must record:
- timestamp
- reason
- changed fields
- new evidence
- impact on thesis
- impact on trade map

---

## 8. Oracle Intelligence

### 8.1 Purpose

Evolve NARS into a generic intelligence ingestion layer rather than a finance-news-only fetcher.

### 8.2 Source extensibility

Support interfaces for:
- news
- RSS
- filings
- research
- market-data feeds
- broker/exchange APIs
- on-chain providers
- PDFs
- CSV
- databases
- internal APIs
- custom scrapers
- future enterprise connectors

### 8.3 Evidence Object

Minimum fields:
- evidence_id
- source_id
- source_type
- raw_reference
- hash
- observed_at
- ingested_at
- freshness
- source_reliability
- evidence_reliability
- entities
- assets
- sectors
- themes
- event_cluster_id
- relevance
- novelty
- impact
- directional_implication
- contradictions
- derived_claims
- lineage
- tenant_id / permission metadata where relevant

### 8.4 Processing pipeline

`Fetch → Parse → Normalize → Deduplicate → Event Cluster → Entity Resolution → Reliability → Relevance → Impact → Contradiction → Evidence Object`

### 8.5 Reliability

Reliability combines:
- source prior
- evidence-specific quality
- contextual AI assessment

No source receives universal correctness by reputation alone.

---

## 9. Discovery Engine

### 9.1 Multi-path discovery

At minimum support:
- Macro → Sector → Theme → Asset
- Event → Asset
- Technical → Asset
- Flow → Asset
- Sentiment → Asset
- On-chain → Crypto
- Cross-Asset → Asset
- Bottom-up anomaly → Sector / Theme rediscovery

### 9.2 Discovery agents

Use Core 8 domains plus dynamic specialists.

Core domains:
- Macro
- Regime
- Fundamental
- Technical
- Flow / Microstructure
- Event
- Sentiment
- Cross-Asset

Within a domain, multiple agents/models may compete.

### 9.3 Opportunity scoring

Internal score may include:
- expected return
- confidence
- evidence quality
- timing
- liquidity
- regime fit
- strategy fit
- downside
- calibration
- agreement
- data quality
- catalyst quality

External presentation uses the approved AAA+ through F- grade system.

---

## 10. AI Council

### 10.1 Composition

Five fixed seats plus one dynamic seat:
1. Macro / Regime
2. Fundamental / Thesis
3. Quant / Statistical
4. Technical / Structure
5. Risk / Portfolio
6. Dynamic Specialist

### 10.2 Deliberation sequence

`Independent analysis → Opinion lock → Reveal → Structured debate → Evidence re-check → Weighted vote`

Initial opinions must be persisted before agents see each other's conclusions.

### 10.3 Weighting

Weight may consider:
- domain relevance
- asset-specific historical performance
- regime fit
- calibration
- recent performance
- evidence quality

### 10.4 Risk veto

Risk has conditional veto authority only under explicit hard-risk conditions such as:
- max-loss violation
- concentration breach
- liquidity failure
- corrupted/stale data
- execution anomaly
- unacceptable R:R
- leverage breach
- kill-switch trigger

### 10.5 Specialists

The system may recommend a specialist, but lower plans require user approval to spend Credits.

A Specialist must:
- analyze
- participate in debate
- vote

It is not merely an appended text answer.

### 10.6 Council performance

Track:
- decision count
- calibration
- outcome contribution
- strongest/weakest regimes
- current voting weight
- recent performance

---

## 11. Structured Decision Object

The Report and AutoTrade system must share a machine-readable decision object.

Minimum fields:
- decision_id
- report_id
- trace_id
- action
- confidence
- grade
- entry_zone
- stop
- targets
- expected_price
- expected_return
- horizon
- recommended_size
- position_risk
- weighted_council_vote
- disagreement_level
- primary_thesis
- critical_risks
- invalidation_conditions
- required_evidence
- specialist_recommendation
- timestamp
- policy_version

---

## 12. Report → AutoTrade Bridge

Every `Use in AutoTrade` action must preserve lineage.

The system must not recreate a new detached investment thesis.

Transferred references include:
- report_id
- report_version
- evidence set
- forecast
- Council session
- structured decision
- trade map

The user then selects or creates a strategy that can operate on the report/asset context.

---

## 13. AutoTrade Product

Primary sections:
- Strategy Rank
- Strategies
- Builder
- Marketplace
- Portfolio / Trade

### 13.1 Strategy origins

Every strategy has one origin:
- ORACLE_OFFICIAL
- AI_GENERATED
- USER_CREATED
- FORKED

Fork lineage must be preserved.

### 13.2 Strategy Rank

Rank views:
- Overall
- KRX
- US
- Crypto
- Trend
- Mean Reversion
- Event
- AI
- User

Each strategy card should show:
- grade
- current lifecycle state
- selected performance metrics
- recent rank movement
- origin

### 13.3 Strategy detail

Required where supported:
- grade
- return
- expectancy
- MDD
- Sharpe
- Sortino
- win rate
- payoff ratio
- sample size
- OOS state
- Monte Carlo state
- regime stability
- parameter robustness
- execution robustness
- current lifecycle
- lineage / fork graph
- recent changes

Actions:
- Paper Run
- Fork
- Modify
- Backtest
- Compare

---

## 14. Strategy Builder

Creation modes:
1. Ask Oracle — natural language
2. Visual Builder
3. Advanced Code / DSL
4. Remix / Fork

Natural language must first become a structured, reviewable Strategy Spec before executable logic is created.

Strategy Spec dimensions:
- universe
- timeframe
- features
- entry
- exit
- stop
- risk
- regime constraints
- horizon
- execution

---

## 15. Strategy Genome and Modification

Strategies should be decomposable into reusable dimensions.

Fork example:

`Oracle Momentum V14 → Hanseo Momentum V1 → Hanseo Momentum V2`

Modification examples:
- change stop from 2 ATR to 1.5 ATR
- restrict to BTC
- add ADX regime filter
- alter sizing
- change exit behavior

All modified strategies must re-enter validation. A fork cannot inherit the parent's grade without retesting.

---

## 16. Mandatory Strategy Qualification

Required pipeline:

`Syntax/Data Integrity → Backtest → Costs/Slippage → Walk Forward → OOS → Monte Carlo → Regime Stress → Shadow → Paper`

Hard-gate failures block promotion.

Top grades require robust validation, not headline return.

---

## 17. Strategy Lifecycle

Use:

`Idea → Incubator → Candidate → Tested → Challenger → Shadow → Paper → Champion Candidate → Human Review → Champion → Watch → Degraded → Retired → Archive`

AI may generate candidates and mutations.

AI may not automatically grant real-money authority.

---

## 18. Marketplace

Beta 1.0 capabilities:
- Publish
- Discover
- Rank
- Search
- Filter
- Save
- Follow
- Compare
- Paper Run
- Fork
- Modify

Do not enable paid strategy sales in Beta 1.0.

Architecture should allow future:
- paid strategy access
- creator subscription
- revenue share
- marketplace fee

---

## 19. Community

Keep Community intentionally lightweight.

Primary content:
- Trending Strategies
- Trending Reports
- New Experiments
- Fork Activity
- Strategy Discussions
- Report Discussions
- Profiles
- Following

Do not prioritize generic social posting over first-class Report and Strategy objects.

Moderation and abuse reporting must exist before broader public launch.

---

## 20. Paper Trading

### 20.1 Beta authority

Beta 1.0 supports Paper only.

Future progression:

`Advisory → Shadow → Paper → Small Live → Full Live`

### 20.2 Execution flow

`Opportunity/Decision → Strategy Router → Portfolio Risk → Execution Risk → Paper Order → Position → Outcome`

### 20.3 Position sizing

`Strategy requested size → volatility adjustment → correlation adjustment → portfolio exposure adjustment → Risk-approved size`

Strategy does not have final sizing authority.

### 20.4 Portfolio risk

Track:
- gross exposure
- net exposure
- asset concentration
- sector concentration
- strategy concentration
- correlation
- volatility
- drawdown
- liquidity
- leverage
- VaR/CVaR where meaningful
- regime

### 20.5 Position reassessment

Material new evidence triggers:

`New Evidence → Materiality → Thesis Impact → Position Council → KEEP / ADD / REDUCE / EXIT`

### 20.6 Kill switches

Support at minimum:
- daily loss
- portfolio drawdown
- data mismatch
- stale data
- provider/API anomaly
- abnormal slippage
- duplicate order risk
- strategy runaway
- correlation spike
- evidence-pipeline failure
- execution-service failure

---

## 21. Trade UX

Trade / Portfolio must show:
- Paper label
- portfolio value
- daily PnL
- total PnL
- risk usage
- active strategies
- positions
- pending orders
- history

Every open position must show:
- current price
- entry price
- entry timestamp
- PnL
- stop
- targets
- expected price
- thesis status
- Council status where applicable
- next reassessment

No critical value may be hidden behind unnecessary navigation.

---

## 22. Decision Replay

Every meaningful trade should be inspectable through:

`Discovery → Report → Council → Strategy → Risk → Order → Position → Outcome`

Stages must be expandable.

Missing lineage must fail closed and display `NOT LINKED` / `DATA GAP`, never guessed associations.

---

## 23. Subscription and Entitlements

Plans:
- Oracle
- Oracle+
- Oracle Pro
- Oracle Enterprise

Working price hypotheses:
- Oracle: ₩24,900/month
- Oracle+: ₩79,000/month
- Oracle Pro: ₩249,000/month
- Enterprise: from approximately ₩1,490,000/month + seats/data/compute

These are hypotheses, not fixed contractual prices.

### Entitlement direction

Oracle:
- Intelligence / opportunities
- basic reports
- limited Council
- limited Paper experience

Oracle+:
- full reports
- Core Council interaction
- practical Paper AutoTrade
- included Specialist Credits
- deeper evidence

Oracle Pro:
- advanced Council
- full strategy builder
- AI Strategy Factory
- full validation tools
- advanced Paper automation
- API
- deeper lineage

Enterprise:
- private connectors
- private intelligence
- team permissions
- custom models/workflows
- audit controls
- dedicated compute/data options

---

## 24. Oracle Credits and Cost Accounting

Use Subscription + Oracle Credits.

High-cost operations may consume Credits:
- Deep Report
- Specialist call
- Council re-run
- advanced scenario generation
- large Monte Carlo
- large backtest
- expensive AI research

Track actual COGS by:
- user
- plan
- report
- Council session
- specialist
- strategy generation
- backtest
- Monte Carlo
- AI usage
- compute
- storage
- market-data usage

Pricing-floor principle:

`Direct variable cost × 1.5`

---

## 25. Enterprise Extension

The same Evidence model should later support private enterprise data.

Required architectural concepts:
- tenant isolation
- RBAC
- private connectors
- private reports
- private Council sessions
- audit logs
- retention rules
- encryption
- permission-aware retrieval

Do not force Enterprise functionality into the Beta UI beyond extension points.

---

## 26. Security and Auditability

Required:
- secure auth
- authorization
- tenant boundaries
- API-key / secret management
- encrypted credentials
- audit events
- model invocation records
- critical financial-action logs
- rate limiting
- abuse protection
- data retention and deletion controls

Future live trading requires stronger credential and execution boundaries than ordinary analytics features.

---

## 27. Observability

Observe independently:
- web/API availability
- runtime health
- persistence
- scheduler
- evidence ingestion
- discovery
- Council
- market feeds
- strategy jobs
- paper execution
- risk engine
- queue delays
- model failures
- cost usage

A single green deployment status must never imply all subsystems are healthy.

---

## 28. AI Architecture

Use model routing rather than the most expensive model everywhere.

Suggested classes:
- low-cost extraction/classification
- mid-tier synthesis/reporting
- high-capability Council/specialist/research

Persist for material AI decisions:
- model/version
- prompt/version
- timestamp
- input lineage
- structured output
- evaluation metadata
- cost record

---

## 29. Legacy Migration Rules

### KEEP
- Canonical Event Ledger
- deterministic Risk
- Paper runtime
- Monte Carlo
- OOS validation
- grade system
- runtime integrity safeguards

### KEEP + PRODUCTIZE
- Strategy Factory
- Strategy Vault
- Champion–Challenger

### REFACTOR UX
- Council
- Evidence
- Forecast
- Markets / Instrument Cockpit

### MIGRATE
- NARS → Oracle Intelligence

### HIDE INTERNAL
- Router
- Arbiter
- Red Team implementation

### ABSORB
- Decision Replay into Report / Trade detail

### DEPRECATE UI
- system-centric consumer navigation
- duplicate log/ledger screens

### ARCHIVE
- Case / Hypothesis / Scenario top-level UX

### NEW
- Report product layer
- Marketplace
- Strategy Fork graph
- Community
- Subscription/Credits

Historical audit and qualification data must survive migration.

---

## 30. Priority Model

### P0 — Foundation / Trust

- canonical lineage protection
- asset identity / market-data truth
- runtime integrity
- Evidence Object
- Report / Strategy / Trade domain contracts
- degraded-state behavior
- Paper cohort preservation
- Report → AutoTrade lineage contract

### P1 — Core Beta Product

- new Home
- Report feed/search/recent
- Oracle Report detail
- visual chart analysis
- Council interaction
- Strategy Rank
- Strategy detail
- Paper Run
- Portfolio / Trade
- Decision Replay
- natural-language strategy builder
- Marketplace read/fork flow

### P2 — Growth / Monetization / Network

- deeper Community
- creator profiles
- richer Marketplace
- Credits purchase UX
- paid specialist flows
- Pro customization
- enterprise extension points
- advanced strategy mutation UX

---

## 31. Success Metrics

### Intelligence
- freshness
- ingestion latency
- deduplication quality
- event clustering quality

### Discovery
- qualified-opportunity precision
- forecast calibration
- false-positive rate

### Report
- report opens
- deep-read rate
- chart interaction
- evidence interaction
- Report → AutoTrade conversion

### Council
- calibration
- disagreement quality
- specialist incremental value

### AutoTrade
- expectancy
- MDD
- risk-adjusted return
- Paper/live divergence readiness metrics
- risk-veto effectiveness

### Strategy Lab
- strategies created
- qualification pass rate
- OOS survival
- Monte Carlo survival
- fork activity
- challenger success

### Business
- trial→paid conversion
- plan mix
- COGS/user
- credit usage
- retention

---

## 32. Definition of Done — Beta 1.0

Beta 1.0 is complete only when:

1. Report and AutoTrade share one canonical decision lineage.
2. Every qualified Report is traceable to its evidence and Council state.
3. `Use in AutoTrade` preserves Report/Decision lineage.
4. Paper orders cannot bypass deterministic Risk.
5. Strategies cannot receive high grades without hard-gate validation.
6. User/AI/fork strategies enter the same validation framework.
7. Trade detail exposes entry/current/stop/target and Decision Replay clearly.
8. Missing/stale data is explicitly displayed rather than inferred.
9. Existing qualification and historical audit data remain preserved.
10. Beta remains PAPER-only.
11. Mobile primary flows are usable without internal engineering terminology.
12. Marketplace supports discover/fork/run without enabling unvalidated paid strategy sales.
13. Community remains lightweight and strategy/report-centered.
14. COGS and major AI/compute costs are measurable per user/workload.
15. CI, runtime safety and rollback requirements remain intact throughout migration.

---

## 33. Product North Star

The defining loop is:

**Research opportunities → understand evidence → validate strategies → automate Paper trading → measure outcomes → improve strategies.**

The product surface must become simpler while the underlying investment engine remains auditable, risk-constrained and evidence-driven.
