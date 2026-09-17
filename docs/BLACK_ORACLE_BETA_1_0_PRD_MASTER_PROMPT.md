# BLACK ORACLE Beta 1.0 — PRD Master Prompt

Use this prompt in a PRD generator to produce an implementation-ready Product Requirements Document for **BLACK ORACLE Beta 1.0**.

---

## Product

**BLACK ORACLE** is an **AI Investment Research & Automated Trading Platform**.

The product should be designed around two primary pillars plus a lightweight social layer:

1. **REPORT** — discover and understand investment opportunities.
2. **AUTOTRADE** — build, rank, modify, validate, and run strategies.
3. **COMMUNITY** — share reports, strategies, experiments, forks, and discussion.

The user-facing product should be simple. The internal engine may remain sophisticated.

The existing BLACK ORACLE codebase already contains important capabilities including evidence ingestion, strategy factory, strategy router, AI Council, deterministic risk, Paper trading, Monte Carlo tools, canonical event lineage, Decision Replay, forecast calibration, crypto research, and KRX Paper infrastructure.

This is **not a greenfield rewrite**. The PRD must preserve and productize valuable existing capabilities while replacing stale or overly technical user-facing surfaces.

---

## Core product promise

BLACK ORACLE should help a user answer two questions:

### REPORT
**What should I pay attention to, and why?**

### AUTOTRADE
**How should a validated strategy trade it?**

The two pillars must share one canonical decision graph.

A Report and an AutoTrade decision must not become separate systems.

Canonical internal flow:

```text
Evidence
→ Intelligence
→ Discovery
→ Opportunity
→ Report
→ Council
→ Structured Decision
→ Strategy
→ Risk
→ Paper Execution
→ Outcome
→ Learning
```

Every material trade should remain replayable from its original evidence and decision state.

---

# 1. Target users

Design for the following user groups:

### Oracle
General investors who want AI-assisted investment research and opportunity discovery.

### Oracle+
Active investors who want full reports, deeper Council interaction, and meaningful Paper automation.

### Oracle Pro
Power users and algorithmic investors who want advanced strategy creation, testing, ranking, automation, APIs, and deeper evidence lineage.

### Oracle Enterprise
Companies and professional teams that may use BLACK ORACLE as private intelligence infrastructure with custom connectors, internal data, private reports, team permissions, and custom AI workflows.

---

# 2. Primary navigation

Target mobile-first navigation:

- **Home**
- **Report**
- **AutoTrade**
- **Community**

Profile, subscription, credits, API, alerts, account connections, and settings should sit outside the primary navigation.

Do not expose internal implementation concepts such as Router, Arbiter, Red Team, NARS, Monte Carlo, or Canonical Ledger as top-level consumer navigation.

---

# 3. Home

Home is a command summary, not a deep analytics screen.

It should show:

- current market regime
- top opportunities
- latest reports
- current Paper portfolio state
- active strategies
- important alerts
- recent BLACK ORACLE activity
- selected community/trending content

The page should answer: **What matters right now?**

---

# 4. REPORT pillar

REPORT is the investment intelligence product.

Required areas:

### Discover
- today's opportunities
- promising sectors/themes
- stocks
- cryptocurrencies
- watchlist

### Search
Search by:
- stock
- cryptocurrency
- sector
- theme

### Recent Reports
- newly published
- updated
- watchlist reports
- report history

### Report Detail
Each qualified report should include:

- asset
- Oracle grade
- direction / decision state
- current price
- entry zone
- stop
- TP1 / TP2 / TP3 where valid
- expected price
- expected return
- time horizon
- risk level
- Bull / Base / Bear scenarios
- scenario probabilities where valid
- why now
- primary thesis
- critical risks
- invalidation conditions
- evidence
- Council result
- Council disagreement
- report updates
- immutable forecast history
- `Use in AutoTrade`

A user should understand the main investment conclusion within approximately 10–15 seconds, with deeper analysis progressively disclosed below.

---

# 5. Visual analysis

Reports should not merely display a generic price chart plus prose.

The product should support visual analytical layers over the actual chart, including where relevant:

- trend
- support/resistance
- entry zone
- stop
- targets
- supply/demand
- volume profile
- momentum
- Elliott Wave
- breakout structure
- forecast cone / projected paths

Users should be able to enable or disable layers.

Where feasible, clicking an AI explanation should highlight the relevant area on the chart.

Missing or low-confidence analysis must be shown as unavailable rather than fabricated.

---

# 6. Oracle Intelligence

The existing NARS-style fetcher should evolve into **Oracle Intelligence**.

It must support extensible evidence ingestion for:

- news
- regulatory filings
- market data
- research
- RSS
- exchange APIs
- on-chain data
- PDFs
- CSVs
- databases
- internal APIs
- enterprise documents
- future custom scrapers/connectors

The primary information unit should be an **Evidence Object**, not merely an article.

Evidence should support:

- source
- source quality
- document quality
- timestamp
- freshness
- relevance
- novelty
- entities
- related assets
- sectors/themes
- event cluster
- market impact
- directional implication
- contradiction relationships
- raw-source lineage
- transformations
- permissions / tenant isolation where applicable

Multiple reports about the same event should be clustered while retaining the original-source lineage.

---

# 7. Discovery engine

BLACK ORACLE should operate continuously and search for promising sectors, themes, stocks, and crypto assets.

Use multi-path discovery rather than one monolithic model.

Possible discovery paths:

- Macro → Sector → Theme → Asset
- Event → Asset
- Technical → Asset
- Flow → Asset
- Sentiment → Asset
- On-chain → Crypto
- Cross-Asset → Asset
- Bottom-up anomaly → sector/theme rediscovery

Use core discovery agents plus dynamically invoked specialists.

Candidates should first appear as lightweight Opportunity cards.

Only candidates passing a strict Qualification Gate should receive expensive Full Reports.

Rejected candidates should remain recorded with rejection reasons for later evaluation.

---

# 8. AI Council

The Council should be part of a Report and decision workflow, not a separate top-level product.

Use:

- 5 fixed core seats
- 1 dynamic specialist seat

Suggested core domains:

1. Macro / Regime
2. Fundamental / Thesis
3. Quant / Statistical
4. Technical / Structure
5. Risk / Portfolio
6. Dynamic specialist

The first Council round must be independent and locked before agents see one another's views to reduce herding.

Then run structured debate:

1. independent analysis
2. opinion lock
3. reveal
4. challenge/rebuttal
5. evidence re-check
6. final weighted vote

Weights may reflect domain relevance, calibration, recent performance, asset class, and regime fit.

Risk has conditional veto authority only for explicit hard-risk conditions.

Council should produce a machine-readable Structured Decision Object, not only prose.

Users may invite additional specialists using Oracle Credits.

Specialists should analyze, debate, and vote.

---

# 9. AUTOTRADE pillar

AUTOTRADE is a **strategy and execution platform**, not simply an automatic order button.

Required areas:

- Strategy Rank
- Official Strategies
- AI Strategies
- User Strategies
- Strategy Builder
- Fork / Modify
- Backtest
- OOS / Walk-Forward validation
- Monte Carlo
- Strategy Marketplace
- Paper Portfolio
- Positions
- Orders
- Trade History
- Decision Replay

Beta 1.0 is **PAPER ONLY**.

Design for future progression:

```text
Advisory
→ Shadow
→ Paper
→ Small Live
→ Full Live
```

Do not enable real-money autonomous trading in Beta 1.0.

---

# 10. Strategy Rank

Strategies from different origins should compete under the same validation framework:

- Oracle official
- AI-generated
- user-generated
- forked strategies

Rankings should not be based on raw return alone.

Use a composite BLACK ORACLE grade and detailed scorecard including where valid:

- return
- expectancy
- Sharpe
- Sortino
- max drawdown
- hit rate
- payoff ratio
- OOS
- walk-forward
- Monte Carlo survival
- regime stability
- parameter robustness
- execution robustness
- sample quality
- liquidity / operational risk

Top grades must require hard-gate validation.

Support multiple leagues such as:

- Overall
- KRX
- US Equity
- Crypto
- Trend
- Mean Reversion
- Event
- AI
- User

---

# 11. Strategy Builder and modification

Support four strategy creation modes:

1. Natural Language
2. Visual Builder
3. Advanced Code
4. Fork / Remix

Natural language must first become a structured Strategy Specification before execution or testing code is generated.

Users should be able to take an existing strategy and modify it, for example:

- change stop rules
- restrict universe
- add a regime filter
- change execution logic
- alter entry / exit rules
- change risk sizing

The modified strategy becomes a new version/fork with clear lineage.

Original and modified versions can then be revalidated and ranked against each other.

---

# 12. Strategy lifecycle

Use a controlled lifecycle such as:

```text
Idea
→ Incubator
→ Tested
→ Challenger
→ Shadow
→ Paper
→ Champion Candidate
→ Human Review
→ Champion
→ Watch
→ Degraded
→ Retired
→ Archive
```

AI may generate and mutate strategies, but may not automatically grant real-capital authority.

Mandatory qualification should include where applicable:

- syntax validation
- data integrity
- backtest
- transaction cost / slippage
- walk-forward
- OOS
- Monte Carlo
- regime stress
- Shadow
- Paper

---

# 13. Marketplace

Beta 1.0 Marketplace should support:

- Publish
- Discover
- Rank
- Save
- Follow
- Compare
- Paper Run
- Fork
- Modify

Each strategy page should display transparent validation and performance evidence rather than marketing claims.

Future architecture should be ready for:

- paid strategies
- creator subscriptions
- revenue sharing
- marketplace fees

However paid strategy sales do not need to be enabled in Beta 1.0.

---

# 14. Community

Community should remain lightweight in Beta 1.0 and primarily reinforce Report and Strategy workflows.

Required concepts may include:

- trending strategies
- trending reports
- experiments
- fork activity
- comments
- profiles
- following
- market/research discussion

Avoid turning Beta 1.0 into a full general-purpose social network.

Strategy objects and Report objects should be first-class shareable community objects.

---

# 15. Report → AutoTrade connection

Every qualified Report should be able to connect into AutoTrade through `Use in AutoTrade`.

Do not discard the existing decision context.

The AutoTrade action should preserve links to:

- Report ID
- Evidence lineage
- Council session
- forecast
- trade plan
- selected strategy
- risk decision
- execution
- outcome

This relationship is a major product differentiator.

---

# 16. Risk and execution

The existing deterministic Risk architecture should remain authoritative.

Strategy proposes; central risk decides final permitted exposure.

Risk should consider where applicable:

- portfolio exposure
- concentration
- correlations
- volatility
- drawdown
- liquidity
- leverage
- strategy concentration
- regime
- data integrity

Stops may combine:

- price
- volatility
- thesis invalidation
- new material evidence

New material evidence may trigger position reassessment:

`KEEP / ADD / REDUCE / EXIT`

Implement multiple kill-switch categories for data, API, execution, drawdown, abnormal slippage, strategy runaway, and related operational failures.

`NO TRADE` must remain a first-class valid result.

---

# 17. Decision Replay and auditability

Preserve BLACK ORACLE's existing auditability as a technical moat.

A completed or rejected trade should be reconstructable as:

```text
Discovery
→ Report
→ Council
→ Strategy
→ Risk
→ Order
→ Position
→ Outcome
```

Historical forecasts and decisions must never be retrospectively rewritten after the outcome is known.

New information creates a new report version or update.

Missing data must remain missing; never invent values to complete a UI.

---

# 18. Pricing and entitlements

Plans:

- Oracle
- Oracle+
- Oracle Pro
- Oracle Enterprise

Working price hypotheses:

- Oracle: KRW 24,900 / month
- Oracle+: KRW 79,000 / month
- Oracle Pro: KRW 249,000 / month
- Oracle Enterprise: from approximately KRW 1,490,000 / month plus seats/data/compute

Use subscription + Oracle Credits.

High-cost operations such as Deep Reports, Specialist calls, Council re-runs, large simulations, and large backtests may consume credits.

The initial pricing floor principle is:

**Direct variable cost × 1.5**

Actual selling price may be higher depending on value, support, licensed data, and margin needs.

The product should track actual COGS by user, plan, AI invocation, report, Council session, specialist, strategy job, backtest, compute, and data use.

---

# 19. Enterprise direction

The Enterprise product is not simply multi-seat Pro.

Long-term Enterprise capabilities may include:

- private data connectors
- internal APIs
- database integrations
- custom scrapers
- private reports
- private Council
- custom AI workflows
- team permissions
- tenant isolation
- audit logs
- dedicated compute
- enterprise API

Oracle Intelligence should therefore be designed as a reusable evidence/intelligence layer rather than a financial-news-only fetcher.

---

# 20. UX direction

Design should be:

**premium consumer fintech with institutional depth**

Prefer:

- mobile-first
- clear hierarchy
- progressive disclosure
- large important metrics
- interactive charts
- restrained animation
- full-screen drill-down instead of cramped modals
- explicit loading / empty / error / stale / data-gap states

Avoid:

- cyberpunk styling
- unnecessary neon
- decorative 3D
- excessive dashboard density
- exposing backend jargon
- animations that block interaction

Motion should explain state, such as:

- Council opinion locking
- Council vote changes
- Specialist joining
- evidence arriving
- qualification progress
- strategy rank movement
- trade lifecycle

---

# 21. Legacy migration

The PRD must explicitly classify existing BLACK ORACLE capabilities into:

- KEEP
- KEEP + PRODUCTIZE
- REFACTOR UX
- MIGRATE
- HIDE INTERNAL
- ABSORB
- DEPRECATE UI
- ARCHIVE
- NEW

Current intended direction:

### KEEP
- Canonical Event Ledger
- deterministic Risk
- PAPER runtime
- Monte Carlo
- OOS / validation
- grade system
- runtime integrity principles

### KEEP + PRODUCTIZE
- Strategy Factory
- Strategy Vault
- Champion–Challenger

### REFACTOR UX
- Council
- Evidence
- Forecast
- Markets

### MIGRATE
- NARS → Oracle Intelligence

### HIDE INTERNAL
- Strategy Router
- Arbiter
- Red Team implementation detail

### ABSORB
- Decision Replay → Report/Trade history and drill-down

### DEPRECATE UI
- System-centric consumer navigation
- unnecessary internal architecture screens

### ARCHIVE
- Case / Hypothesis / Scenario legacy top-level UX

### NEW
- Report product layer
- Strategy Marketplace
- Fork graph
- Community layer
- subscription / credits / entitlements

Do not destroy historical audit data when a legacy UI is retired.

---

# 22. Non-negotiable safety and integrity rules

The PRD must preserve these existing BLACK ORACLE invariants:

1. deterministic Risk cannot be bypassed by AI agents.
2. new authority starts in Shadow.
3. strategy/risk/execution semantics cannot silently change inside an existing qualification cohort.
4. historical decisions remain immutable.
5. missing data is displayed as missing.
6. every material decision should be traceable.
7. promotion is evidence-gated.
8. real capital, if enabled later, must progress through canary stages.
9. UI polish does not count as evidence of trading quality.
10. paid access must never be treated as permission to bypass risk qualification.

---

# 23. Beta 1.0 scope

## Must be designed and implemented for Beta 1.0

- Home
- Report discovery/search/recent reports
- Oracle Intelligence architecture
- Evidence Objects
- Opportunity discovery
- Qualification
- Full Report
- visual chart analysis
- forecast scenarios
- Council
- Specialist framework
- `Use in AutoTrade`
- Strategy Rank
- Strategy Builder
- Fork / Modify
- validation pipeline
- Marketplace free discovery/fork model
- Paper AutoTrade
- Portfolio/positions/history
- Decision Replay
- lightweight Community
- subscription entitlements
- Oracle Credits architecture
- cost accounting
- auditability / observability

## Architect now, but do not enable real-money authority in Beta

- live broker execution
- autonomous live trading
- automatic live strategy promotion

## Later

- paid strategy sales
- creator revenue share
- full social network features
- broad enterprise deployments
- institutional commercial market-data redistribution where economically justified

---

# 24. Required PRD output

Generate a detailed, implementation-ready PRD containing:

1. Executive summary
2. Product vision and positioning
3. Target users / personas / JTBD
4. Scope and non-goals
5. Information architecture
6. User journeys
7. Functional requirements by feature
8. User stories
9. Acceptance criteria
10. Edge cases and failure states
11. Subscription entitlement matrix
12. Core data entities and relationships
13. AI agent architecture
14. Trading and risk architecture
15. Strategy lifecycle / validation architecture
16. Marketplace and Community requirements
17. Security / privacy / audit requirements
18. Observability and cost accounting
19. Legacy migration plan
20. Phased implementation roadmap
21. Definition of Done

For each major feature, specify:

- purpose
- user value
- functional requirements
- required data
- dependencies
- entitlement/plan
- success metrics
- testable acceptance criteria
- error / empty / degraded states

Clearly distinguish:

- confirmed product requirements
- architectural recommendations
- assumptions
- post-Beta scope
- dependencies requiring external verification

Do not simplify BLACK ORACLE into a generic stock dashboard, generic AI chatbot, or simple trading bot.

The defining product loop is:

**Research opportunities → understand evidence → validate strategies → automate Paper trading → measure outcomes → improve strategies.**
