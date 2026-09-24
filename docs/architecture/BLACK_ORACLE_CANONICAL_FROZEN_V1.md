# BLACK ORACLE — Canonical Project Source

**Status:** Architecture Freeze Candidate v1  
**Updated:** 2026-09-24  
**Purpose:** Canonical project source for BLACK ORACLE conversations and future implementation planning.

> This file summarizes the latest confirmed BLACK ORACLE product direction.  
> When older chats, files, repository documents, or prior architecture notes conflict with this source, prefer this source unless Hanseo explicitly makes a newer decision.

---

## 1. Product Constitution

BLACK ORACLE is a **persistent investment research and decision-support institution**.

It is not merely a market-summary app or an autonomous trading bot. Its long-term advantage should come from remembering:

- what information it saw,
- why it made a judgment,
- where that judgment was wrong,
- how the judgment or system changed afterward,
- and how that accumulated history should improve future decisions.

### Primary user outcome

> “I understood today’s market faster, learned something, and could apply it to an investment decision.”

### Core product value

1. Research / Report generation
2. Forecast generation
3. Strategy / decision-support generation
4. Compounding institutional memory

### Initial target

- Hanseo-first
- Later expandable toward individual investors

### Primary success criterion

Make a high-quality investment decision process repeatable.

### Decision authority

The user retains **mandate / policy authority**.

The user defines:

- allowed operating scope,
- risk envelope,
- automation permissions.

Per-order manual approval is not required inside explicitly delegated boundaries.

A new LIVE Production version still requires a separate governed activation step.

---

## 2. Canonical Six-Domain Architecture

BLACK ORACLE is organized into six top-level domains.

### A. Product Experience

User-facing surfaces:

- Home / Dashboard
- Interactive Globe
- Asset Chart
- Reports
- Watchlist
- Alerts
- Contextual AI Chat
- Oracle Edu
- Paid-depth / entitlement presentation

Experience principles:

- progressive disclosure,
- financial-terminal density with readable infographics,
- Korean-first explanation,
- chart-first asset experience,
- one-line → three-line → detailed reasoning.

Within roughly five seconds on an asset page, the user should understand:

1. BLACK ORACLE’s current stance,
2. whether the asset currently looks attractive or concerning,
3. the main reason why.

---

### B. Intelligence / Research Pipeline

Canonical flow:

`NARS / Source Intake → Evidence → Research Specialists → Council → Forecast Methods → Forecast Synthesis`

#### NARS

NARS should:

- collect selectively and cost-consciously,
- map events, keywords, countries, companies, sectors, themes, technologies, commodities, and assets,
- find both obviously important news and smaller cumulative signals,
- cluster duplicate / same-origin coverage,
- track market impact, trending intensity, freshness, and verification state,
- support news, filings, prices, macro, research, social, on-chain, and future source types.

#### Evidence

Evidence is not just a source archive.

Track where possible:

- provenance,
- credibility,
- freshness,
- market impact,
- independence / common-source lineage,
- contradiction state,
- historical revisions,
- affected assets.

Important rumors may be tracked for market impact but must remain distinguishable from verified facts.

If an Evidence item is invalidated, dependent Research / Forecast / Report artifacts must remain traceable for review.

#### Research

Research dynamically summons useful specialists rather than running every Agent every time.

Possible specialties include:

- macro,
- accounting,
- sector,
- technology,
- regulation,
- geopolitics,
- technical analysis,
- asset-specific domains.

Research should expose:

- supporting evidence,
- opposing evidence,
- risks,
- opportunities,
- contradictions,
- unknowns.

#### Council / Deliberation

Default protocol:

1. independent initial opinions,
2. initial position lock,
3. evidence-aware debate,
4. Red Team failure scenarios,
5. revision after debate,
6. final synthesis.

Evidence strength matters more than majority vote.

Important dissent remains visible.

“No consensus” is a valid outcome.

#### Forecast

Keep these distinct:

- fair / intrinsic-value range,
- realized future-price forecast.

Forecast methods may include:

- technical,
- fundamental,
- event/news,
- statistical,
- ML,
- specialist,
- Council-derived methods.

Technical Analysis is a **Forecast method family**, not a top-level product system.

Forecast synthesis must read underlying reasons and evidence rather than blindly average scores.

Forecasts use standard reference horizons. Exact horizon durations remain a later calibration item.

Historical Forecasts are preserved and reviewable against realized outcomes.

---

### C. Strategy System

Purpose:

> “Given the current market / asset state and BLACK ORACLE’s Forecast, how can an attractive trade or action be constructed?”

Strategy is a composed system, not one monolithic Agent.

Canonical structure:

`Strategy Routing → Champion Pool → Trade Planner → Final Decision Agent → Risk-aware proposal interface`

#### Strategy Routing

Combines:

- asset-trait classification,
- market-level regime,
- asset-level regime,
- Champion applicability,
- Champion ranking.

Assets may have multiple traits.

Stock and crypto may use materially different trading logic.

One-model-per-stock is **not** the target.

#### Champion model

- Keep approximately 2–3 applicable active Champions per context.
- One top-ranked Champion drives the primary Strategy.
- Other applicable Champions continue in PAPER / Shadow.
- Ranking considers recent performance, long-run validation, and regime suitability.
- Champions have human-readable names and versions.
- Weak Champions may become dormant.
- Dormant Champions may return when relevant.

#### Strategy output

User-facing judgment vocabulary:

`Strong Buy → Buy → Weak Buy → Neutral → Weak Sell → Sell → Strong Sell`

Keep separate:

- directional probability,
- Strategy Strength,
- Forecast Reliability.

Strategy Strength means **trade attractiveness / expected-value quality**, not the probability that price rises.

Strategy may expose:

- expected return,
- expected loss,
- reward/risk,
- entry range,
- target / take-profit range,
- stop / invalidation conditions,
- expected holding horizon.

BLACK ORACLE should not prescribe rigid split-entry or staged take-profit schedules by default.

NO_TRADE / WAIT is valid when validated conditions are not met, but should not become a lazy default.

Long and short strategies are both allowed when justified.

#### User influence

BLACK ORACLE should form an independent view before considering the user’s preferred direction where practical.

User-modified Strategy remains a separate version.

A user modification may automatically create a **private Candidate** for that user’s evaluation.

Shared / global Experiment Lab use requires explicit user consent.

---

### D. Experiment / Evaluation System

Experiment Lab mission:

> Continuously improve BLACK ORACLE as an internal R&D organization.

Current Experiment Lab scope includes:

- Evidence logic,
- Research methods,
- Agent / prompt composition,
- Council composition,
- Forecast methods,
- technical combinations,
- Strategy rules,
- Risk parameters,
- Execution logic,
- measurable analytical / decision / runtime behavior.

Current exclusion:

- UI visual design,
- Report layout experiments.

Those may be added later explicitly.

#### Experiment lifecycle

`Idea → Formalize → Candidate → Historical Tests → Regime Tests → OOS → Benchmark / Random Baseline → Robustness / Monte Carlo → PAPER / Shadow → Challenger → Champion → Production Activation`

#### Promotion authority

A Candidate / Challenger may **automatically reach Champion** when sufficiently demanding predefined validation gates are passed.

Champion status does **not** authorize LIVE Production.

LIVE Production activation is a separate governed action.

Automatic rollback may only return to a previously approved Production version.

#### Experiment principles

- failure is not deletion,
- weak / failed ideas remain in lineage / Vault,
- AI may generate new experiment ideas,
- AI may recombine useful fragments from prior weak ideas,
- complex rules are allowed only if explainable,
- human / user / expert / AI provenance remains recorded,
- cost is staged: cheap filters first, expensive validation later,
- Experiment Lab may request more budget during materially important events.

#### Shared Evaluation / Attribution Engine

Use one shared engine for:

- Forecast accuracy / calibration,
- Strategy outcomes,
- Champion comparisons,
- Candidate experiments,
- Risk decision quality,
- Execution quality,
- post-signal / post-trade root-cause attribution,
- counterfactual review.

Core evaluation priorities include:

- win rate,
- MDD,
- expectancy,
- payoff asymmetry,
- robustness,
- realistic costs,
- OOS behavior,
- regime stability,
- Monte Carlo behavior.

Exact thresholds remain calibration work.

---

### E. Trading Runtime Safety

Internal runtime:

`Strategy System → Hard Risk Gate → Execution Adapter`

#### Hard Risk Gate

Hard Risk is:

- independent,
- deterministic where possible,
- non-bypassable.

Strategy may be risk-aware but cannot change or bypass hard Risk boundaries.

Risk may:

- veto,
- resize,
- reduce leverage,
- delay entry,
- impose tighter constraints,
- propose compliant alternatives.

Experimental Risk versions cannot directly modify live settings.

If the Hard Risk Gate fails, LIVE stops.

#### Execution Adapter

Execution is intentionally small and mechanical.

It receives:

- order intent,
- quantity,
- allowed price conditions,
- slippage tolerance,
- cancellation rules.

It may:

- transmit orders,
- confirm fills,
- enforce pre-defined execution boundaries,
- cancel when Strategy-defined tolerance is violated.

It must not invent new trade logic.

If order state is uncertain, fail closed to avoid duplicate orders.

PAPER and LIVE should share logic where practical, while LIVE uses stricter fail-closed behavior.

---

### F. Shared Data / Memory / Orchestration Platform

#### Canonical Data

Use a shared canonical source of truth rather than unrelated copies inside each subsystem.

High-value history should be retained as long as practical.

Very high-frequency raw data may be compressed or aggregated over time.

#### Market / Asset Relationship Graph

Connect:

- events,
- companies,
- sectors,
- countries,
- themes,
- technologies,
- commodities,
- people,
- assets.

Preserve first-, second-, and deeper-order impact paths.

This should feel closer to a Bloomberg-terminal-like relationship layer than a simple news feed.

#### Portfolio Context

Shared state for:

- real positions,
- PAPER positions,
- Shadow portfolios,
- Champion virtual portfolios,
- exposures,
- directional bias,
- concentration,
- delegated automation limits.

#### Institutional Memory

One logical memory system with three concerns:

1. **Decision Ledger**  
   Important decision / state-change lineage.

2. **Version Registry**  
   Immutable component versions, approval state, aliases, lineage, rollback targets.

3. **Archive / Vault**  
   Old Evidence, Forecasts, Strategies, experiments, reports, failures, and dormant versions.

Important history should be reconstructable:

`Market Context → Evidence → Research → Forecast → Champion → Strategy → Risk → Execution / Non-execution → Outcome`

Do not retain unrestricted raw Agent chain-of-thought.

Retain:

- auditable conclusions,
- evidence references,
- material reasoning summaries,
- version identity,
- revisions,
- decisions.

#### Event / Trigger Orchestration

Orchestration should:

- detect meaningful information changes,
- identify affected assets / systems,
- selectively recompute only required Forecasts / Strategies / Reports,
- emit material-change events for Watchlist / Alert / Report / Chart,
- control compute cost.

#### Cost / Observability

Track near-real-time cost by subsystem.

Support:

- daily / weekly / monthly budgets,
- deprioritization of low-value expensive work,
- higher compute during material events,
- bounded free usage,
- paid Credit / compute allowances where appropriate.

#### Data Quality / Freshness

- stale critical price data blocks Strategy refresh,
- failed primary Evidence sources trigger alternate-source search,
- lower-quality fallback data is disclosed,
- partial Forecast methods or Council participants may allow degraded continuation if clearly marked.

---

## 3. Context Universe vs Decision Universe

### Context Universe

Markets BLACK ORACLE may ingest, map, discuss, display, and use as cross-asset context.

Includes:

- equities,
- crypto,
- FX,
- rates,
- commodities,
- macro,
- other relevant domains.

### Initial Decision Universe

Production-grade decision scope initially includes:

- **Equities**
- **Crypto**

Other markets may inform decisions without pretending they already have validated production-grade Strategy / Risk / Execution contracts.

---

## 4. Core Semantic Contract

Never collapse these concepts internally:

### Directional Probability

Probability of the defined price / outcome direction over a defined horizon.

### Strategy Strength

Attractiveness / expected-value quality after probability, upside, downside, payoff asymmetry, and risk are considered.

### Forecast Reliability

How dependable the forecasting process / result is based on calibration, historical performance, regime relevance, model availability, and related evidence.

### Evidence / Data Quality

Freshness, coverage, source credibility, independence, contradiction state, and completeness.

### Fair Value

Estimated intrinsic / justified value range.

### Future Price Forecast

Expected realized market-price range / path over time.

The primary UI may simplify these, but underlying semantics remain separate.

---

## 5. Report / Asset Experience

### Report

Use one Report Artifact system.

Support:

- comprehensive daily report,
- separated sections through scrolling,
- overnight analysis before morning use,
- urgent intraday report,
- archived prior versions,
- market mood / stance headline,
- conclusion-first hierarchy,
- “what changed since yesterday,”
- upcoming event / condition checklist,
- narrative continuity with prior Forecasts.

Global / market / sector / asset reports share the same artifact system with context-specific templates.

### Asset Page

- chart is the primary surface,
- Report / analysis opens as a panel,
- mobile opens chart-first,
- Forecast range is an optional layer,
- historical Forecast vs realized price can be overlaid,
- historical Strategy judgments can be a layer,
- news / earnings / FOMC-like events can appear on the timeline,
- major Council shifts may appear as events,
- default chart remains candles + user-selected indicators.

### Stance

Use a gauge / speedometer-style Strong Buy ↔ Strong Sell presentation.

Drill-down:

- one-line,
- ~three-line,
- detailed explanation.

Large stance changes are prominent.

Change causes may include:

- news,
- technical,
- earnings,
- macro,
- regime,
- risk.

Show both high-confidence and high-uncertainty areas.

---

## 6. Alerts

Alerting is primarily user-directed by asset / event type.

The earlier “3 core + 2 custom” concept is a **light notification-volume target**, not five mandatory alert categories.

Alert behavior:

- concise and declarative,
- tap opens the relevant chart at the event time,
- latest / urgent Report is immediately reachable,
- tiny Forecast changes update silently.

The same material-change event stream should feed:

- Alerts,
- Watchlist prioritization,
- Report markers,
- Chart events.

---

## 7. Paid Depth / Learning

### Free

Enough value to understand BLACK ORACLE:

- price,
- one-line composite AI judgment,
- stance,
- limited / teaser depth.

### Paid

Primary value:

- deeper analysis,
- more AI capability,
- richer data,
- deeper Evidence lineage,
- Council detail,
- Forecast history / failure review,
- Champion / Shadow performance,
- internal Strategy detail,
- specialist / expert-persona access,
- higher usage / compute allowances.

Payment changes **depth and capability**, not the underlying truth.

### Oracle Edu

Learning may include:

- inline contextual concept explanations,
- adaptive explanation difficulty,
- reinforcement of repeated misunderstandings,
- deeper paid Oracle Edu surface,
- chart / Strategy skill feedback,
- progression / level-up mechanics.

Desired paid-user outcome:

> “Financial knowledge accumulated, and it actually helped my investing.”

---

## 8. AI Conversational Layer

Asset-context chat should know:

- current asset,
- timeframe,
- selected indicators,
- Report,
- Forecast,
- Strategy.

Temporary requests such as “analyze only with RSI” do not overwrite official Strategy.

Useful temporary analyses may become private Experiment Candidates.

“Why buy?” should use the same evidence / reasoning lineage as the Final Decision Agent.

User disagreement should trigger evidence re-review rather than automatic agreement.

User links / information may enter Evidence and trigger downstream review.

External expert input is stored as explicit Expert Input.

One-tap “왜?” access is desirable from Home / Asset / Report.

---

## 9. Failure / Recovery

- partial NARS failure may allow degraded Report generation if core data remain valid,
- stale critical price data blocks Strategy,
- alternate sources are searched automatically,
- lower-quality fallback sources are disclosed,
- Forecast may continue with fewer methods if marked degraded,
- Council may continue with fewer Agents if marked degraded,
- Hard Risk failure stops LIVE,
- unknown execution state fails closed,
- PAPER may continue best-effort where safe,
- user-facing errors should explain operational impact in plain Korean,
- recovery should generate an incident report with duration, affected functions, and data gaps.

---

## 10. Versioning / Rollback

Maintain separate version identities for:

- Product,
- Forecast,
- Strategy,
- Champion,
- Prompt,
- Council / Agent configuration,
- Risk,
- other materially distinct components.

General users mainly see Product version.

Detailed audit views may expose component versions.

Important changes normally pass Experiment Lab validation.

Emergency bug fixes may bypass part of the normal path, followed by immediate automated regression / validation.

Rollback:

- one-click recovery to previously approved versions,
- automatic rollback allowed when quality metrics collapse,
- automatic rollback never promotes a new unapproved Candidate.

---

## 11. Explicit Non-Goals / Retired Designs

Do **not** design these as separate top-level systems:

- Validation,
- Technical Analysis,
- Ledger,
- Vault,
- Classifier,
- Router,
- separate Alert engine per feature,
- separate Report engine per report type.

Do **not** pursue at the current stage:

- one independent model per stock,
- unrestricted raw Agent reasoning retention,
- duplicate copies of common data,
- monolithic “one AI does everything” Strategy,
- full graphical decision replay as the primary audit experience,
- all BO overlays enabled by default,
- permanent deletion of failed Strategies,
- full organization / department RBAC.

### Superseded rules

- “top 5–10% Champion pool” → replaced by approximately 2–3 applicable active Champions per context.
- “automatic promotion only to Challenger” → replaced by automatic Champion eligibility when hard gates pass.
- “do not recommend take-profit range” → replaced; take-profit range is allowed, rigid staged take-profit is not default.
- “human final decision means manual approval for every order” → replaced by mandate / policy authority.

---

## 12. Deferred Calibration Work

These remain open intentionally and do **not** block architecture freeze:

- exact standard Forecast horizons,
- exact Monte Carlo success definition,
- supplemental evaluation metrics,
- benchmark set,
- minimum validation duration by horizon,
- OOS thresholds,
- Champion promotion / downgrade thresholds,
- hard gates for automatic Champion status,
- Risk envelope values,
- material-change thresholds,
- slippage / execution tolerance,
- asset / regime classifier details,
- Evidence scoring formula,
- portfolio-concentration thresholds,
- Credit pricing / plan limits,
- notification defaults,
- exact reliability visualization.

These should be resolved later using PAPER evidence and measured system behavior rather than guessed upfront.

---

## 13. Build Sequencing After Approval

Architecture does not imply every capability should be built simultaneously.

### Foundation

- canonical data contracts, including Point-in-Time / as-of correctness,
- Institutional Memory / immutable Decision Run identity / Version Registry basics,
- Market / Asset Graph foundation,
- Orchestration / event contracts,
- Evidence lineage,
- PAPER-safe Evaluation.

### Decision Engine

- Intelligence / Research,
- Forecast,
- Strategy Routing + Champions,
- Evaluation / Attribution,
- Hard Risk contract.

### Experience

- chart-first Asset page,
- Report Artifact system,
- Home / Globe,
- Watchlist / Alerts,
- contextual AI Chat.

### Advanced Later

- broad LIVE automation,
- deep Oracle Edu curriculum,
- external expert workflows,
- cross-asset Decision Universe expansion,
- organization-grade permissions,
- advanced monetization tuning.

---

## 14. Current Governance / No-Code Gate

**Architecture review gate is satisfied.**

The consolidated Product Rebuild Specification / Architecture Freeze is approved as FROZEN v1 on 2026-09-24. Implementation, refactor, PR, deployment, infrastructure mutation, or production migration begins only after a separate explicit execution instruction from Hanseo.

When development is later authorized:

- inspect current GitHub / runtime first,
- map existing implementation against this specification,
- classify existing components as KEEP / MODIFY / DELETE / POSTPONE,
- then create the migration roadmap,
- then implement.

Do not silently revive older superseded BLACK ORACLE architecture.

---

## 15. Project Working Rule

For BLACK ORACLE redesign work:

1. Hanseo speaks first.
2. IAN structures and audits second.
3. Do not force multiple-choice framing unless it genuinely helps.
4. Preserve raw intent before formalizing requirements.
5. Record confirmed decisions before moving on.
6. Treat conflicts explicitly rather than guessing.
7. Separate product design from implementation.
8. Use evidence when a decision materially benefits from external validation.
9. Do not overbuild speculative architecture.
10. Prefer a smaller coherent system over many impressive-looking disconnected subsystems.

---

## 16. Canonical Identity

BLACK ORACLE should ultimately behave like:

> **a market-intelligence and investment R&D institution with institutional memory, a validated decision engine, and optional controlled execution — not an AI that merely outputs BUY or SELL.**

---

## 17. Final Architecture Invariants

The following invariants are mandatory architectural contracts and remain binding across implementation revisions.

### 17.1 Point-in-Time Correctness

All historical evaluation, Forecast reconstruction, Strategy testing, Experiment Lab validation, and attribution must use only information that was available to BLACK ORACLE at the relevant historical point in time.

Canonical data and Evidence artifacts must preserve sufficient temporal metadata, including:

- event time,
- observation / ingestion time,
- revision identity,
- as-of state where applicable.

Future revisions or subsequently discovered information must not silently leak into historical evaluation.

### 17.2 Immutable Decision Run Identity

Every material official decision cycle must receive an immutable **Decision Run / Trace identity**.

A Decision Run must make it possible to reconstruct the material chain:

`Market / Portfolio Context → Data Snapshot → Evidence → Research → Forecast → Champion → Strategy → Risk → Execution / Non-execution → Outcome`

The trace must reference the relevant model, prompt, configuration, component, data, Evidence, and version identities necessary for audit and reproducibility without retaining unrestricted raw Agent chain-of-thought.

### 17.3 Validation State and Deployment State Are Orthogonal

Strategy validation status and deployment status remain separate concepts.

Validation lifecycle:

`Candidate → Challenger → Champion → Dormant / Retired`

Deployment lifecycle:

`Offline → PAPER / Shadow → Production`

Champion means that predefined validation standards have been satisfied. Champion status alone never grants LIVE Production authority.

Production activation requires a separately authorized Production Activation action.

### 17.4 BLACK ORACLE and AUTOTRADE Boundary

BLACK ORACLE remains primarily a research and decision-support institution.

BLACK ORACLE may generate validated Strategy, Risk constraints, and approved execution intent.

Actual autonomous real-money execution may operate through a separately isolated **AUTOTRADE** runtime or deployment boundary.

AUTOTRADE consumes authorized execution intent and is responsible for:

- broker / exchange connectivity,
- account isolation,
- order lifecycle management,
- fill reconciliation,
- actual execution state.

This boundary must not duplicate Strategy authority or bypass BLACK ORACLE Risk contracts.

### 17.5 Execution State Integrity

LIVE execution must use idempotent order intent and an explicit order-state lifecycle.

Restart, timeout, partial-fill, unknown-state, or network-failure conditions must not permit blind duplicate submission.

Execution state must be reconciled against the authoritative broker / exchange state before autonomous trading resumes after uncertainty.

Unknown material execution state fails closed.

---

## 18. Architecture Freeze Status

**ARCHITECTURE FROZEN v1 — APPROVED BY HANSEO ON 2026-09-24.**

The six-domain architecture, semantic boundaries, retired / superseded rules, deferred calibration scope, and the Final Architecture Invariants above now constitute the frozen top-level architecture baseline.

Architecture changes after this point require an explicit architecture-change decision rather than silent drift during implementation.

**Implementation has not started in this action and requires a separate execution instruction.**
