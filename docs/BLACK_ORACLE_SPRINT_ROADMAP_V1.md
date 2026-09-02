# Black Oracle Sprint Roadmap v1

## Operating principle

Black Oracle is developed as a sequence of gated product sprints. Each sprint must produce an observable artifact, pass an explicit exit gate, and preserve the safety boundary that learning can be automated while live capital deployment remains controlled.

Core product loop:

`DATA -> EVIDENCE -> PERSONA ANALYSIS -> DEBATE -> FORECAST -> DECISION -> RISK -> EXECUTION / NO TRADE -> LEDGER -> RESOLUTION -> LEARNING`

Learning loop:

`OUTCOME -> POST-MORTEM -> INDICATOR WEIGHT UPDATE -> PERSONA WEIGHT UPDATE -> DEBATE WEIGHT UPDATE -> CHALLENGER -> VALIDATION -> PROMOTION CANDIDATE`

Live deployment is never unlocked by calendar alone.

---

## Sprint 0 — Integration & Baseline

### Goal
Combine the current Trading Core and Redesign v3 into one integration build without merging experimental branches directly into main.

### Scope
- integrate paper-trading core and Decision OS UI
- create stable frontend adapters for runtime health, paper state, performance, loop status, evidence, universe and multi-timeframe APIs
- verify Login -> Command -> Operations -> Cases / Forecasts / Council / Ledger navigation
- preserve Paper-only execution boundary
- remove or isolate development-only authentication shortcuts before public deployment
- establish a single Preview environment for end-to-end QA

### Deliverable
One Preview where real Paper Engine state can be inspected from the redesigned UI.

### Exit gate
- production build passes
- trading tests pass
- no duplicated or conflicting route state
- UI renders real engine state without fabricated performance values
- no live exchange credential or order authority introduced

---

## Sprint 1 — Operations MVP

### Goal
Make the system visibly operational, not merely analytical.

### New first-class workspace
`OPERATIONS`

### Modules
1. Live Decision Tape
   - timestamp
   - market
   - regime
   - Oracle Trade Score
   - confidence
   - ENTER / HOLD / EXIT / NO TRADE
   - risk disposition
   - primary reason

2. Paper Portfolio
   - equity
   - cash
   - daily P&L
   - total return
   - current drawdown
   - max drawdown
   - open positions

3. Performance Board
   - trades
   - wins / losses
   - win rate
   - expectancy
   - profit factor
   - payoff ratio
   - average win / loss
   - score-bucket performance

4. Data Ingestion Monitor
   - market universe status
   - 15m / 1h / 4h freshness
   - liquidity refresh
   - evidence count
   - contradiction count
   - checkpoint status

5. Runtime Health
   - scheduler / loop status
   - cycle count
   - last cycle finish
   - cycle duration
   - errors
   - persistence health
   - risk lock

### Exit gate
- every displayed metric is sourced from a real runtime field or explicitly labeled unavailable
- NO TRADE decisions are visible, not only fills
- stale / degraded states are visually distinct
- mobile Operations view remains usable without horizontal compression

---

## Sprint 2 — Autonomous Paper Reliability

### Goal
Run unattended Paper observation reliably for multiple days.

### Scope
- Supabase scheduler -> Edge Function -> Vercel cycle flow
- durable checkpoint restore/save
- duplicate-cycle lease
- stale-data fail-closed behavior
- API timeout recovery
- persistence recovery
- invocation error handling
- restart recovery
- cycle-level audit event

### Soak test
Minimum 72 hours before the sprint is considered complete.

### Exit gate
Target thresholds:
- cycle success > 99%
- duplicate mutation = 0
- duplicate orders = 0
- checkpoint loss = 0
- risk bypass = 0
- unhandled crash = 0
- stale data never results in a new trade

If this gate fails, no Live-readiness work may unlock order authority.

---

## Sprint 3 — Observability & Decision Audit

### Goal
Make every automated action and non-action explainable after the fact.

### Required decision trace
For every market evaluation:
- regime
- 4H bias
- 1H regime / momentum
- 15m entry context
- Event score
- Trend / Momentum score
- Mean-Reversion score
- liquidity state
- Oracle Trade Score
- confidence
- risk result
- final action
- NO TRADE or rejection reason

### Runtime observability
- market-data age
- API latency
- cycle duration
- decision latency
- persistence latency
- source freshness
- exception taxonomy
- kill-switch events

### Exit gate
A closed Paper trade and a NO TRADE case can both be reconstructed from Ledger without reading application logs manually.

---

## Sprint 4 — Adaptive Council & Debate Engine

### Goal
Turn Council from a multi-model presentation layer into an evidence-bound debating system that can learn which analytical lenses and debate dynamics improve outcomes.

### Initial personas / analytical lenses
The exact set can evolve, but the first implementation should separate at least:
- Momentum / Trend
- Mean Reversion
- Event / News
- Macro / Cross-asset context
- Liquidity / Execution quality
- Risk

Each persona has a distinct feature set, internal indicator weights, prior assumptions and confidence.

### Debate protocol

#### Round 0 — Independent analysis
Personas cannot see one another's conclusions before producing an initial position.

Each output must include:
- claim
- evidence IDs
- observed data
- probability / confidence
- action implication
- invalidation condition
- uncertainty

#### Round 1 — Opening arguments
Each persona publishes its strongest evidence-backed thesis.

#### Round 2 — Cross-examination
Personas challenge another lens on:
- ignored evidence
- regime mismatch
- over-weighted indicators
- stale assumptions
- execution feasibility
- tail risk

#### Round 3 — Rebuttal
Each persona may update its probability, confidence and action implication after reviewing criticism.

#### Round 4 — Counterfactual
Every persona must answer:
`What would need to be true for my conclusion to be wrong?`

#### Round 5 — Final position
Each persona emits a final vote plus remaining dissent.

#### Round 6 — Meta-adjudication
The system aggregates the debate into:
- final forecast
- confidence
- decision disposition
- dominant argument
- preserved dissent
- unresolved uncertainty
- trigger / invalidation conditions

### Critical rule
Dissent is never discarded. The system must preserve who disagreed, why, and whether the dissent later proved informative.

### Three-layer adaptive genome

#### 1. Indicator Genome
Weights inside each persona.

Example:
`EMA / MACD / ROC / Volume / 4H alignment`

#### 2. Persona Genome
Council-level influence by regime, asset and timeframe.

Conceptual form:
`PersonaWeight(regime, asset, timeframe)`

#### 3. Debate Genome
Weights governing how much the council should react to the debate itself.

Initial candidates:
- opening argument weight
- cross-examination influence
- rebuttal adjustment
- dissent penalty / dissent value
- counterfactual weight
- historical calibration weight

### Post-mortem learning
After resolution, evaluate:
- which persona was directionally correct
- which persona was calibrated
- which objection was ignored
- whether dissent predicted failure
- whether rebuttal improved or degraded the forecast
- whether the meta-adjudicator overruled useful minority evidence

### Reward function
Never optimize only for raw P&L.

The evaluation must include a combination of:
- forecast accuracy
- calibration / Brier score
- risk-adjusted P&L
- expectancy
- drawdown penalty
- stability
- regime robustness
- slippage / fee sensitivity

### Promotion safety
Adaptive changes generate Challengers. They do not mutate the live Champion in place.

### Exit gate
- same evidence produces reproducible structured debate records
- every argument is linked to evidence IDs
- pre-debate and post-debate probabilities are stored
- dissent survives final aggregation
- post-mortem can attribute useful / harmful adjustments
- weight changes create a new versioned Challenger rather than silently replacing the Champion

---

## Sprint 5 — Strategy Factory Alpha

### Goal
Generate and evaluate multiple strategy / council configurations as controlled Challengers.

### Strategy Genome
At minimum:
- strategy ID
- generation
- parent
- market scope
- timeframe
- regime preference
- persona weights
- indicator weights
- debate weights
- entry threshold
- exit threshold
- ATR protection
- take-profit logic

### Alpha scale
Start with approximately 5–20 Challengers, not hundreds.

### Rules
- no automatic live promotion
- challengers run in backtest, shadow or Paper mode
- mutation bounds are constrained
- every generation is auditable

### Exit gate
The system can compare Champion vs Challengers using identical data windows and reproducible configuration snapshots.

---

## Sprint 6 — Experiment Lab & Robust Validation

### Goal
Prevent apparent improvements from being accepted because of luck or overfitting.

### Validation stack
`Candidate -> Backtest -> Walk-forward -> Monte Carlo -> Cost stress -> Regime stress -> Paper Challenger -> Review`

### Metrics
- expectancy
- profit factor
- max drawdown
- Sharpe / risk-adjusted return where meaningful
- stability
- ruin probability
- slippage sensitivity
- fee sensitivity
- regime robustness
- confidence intervals

### Exit gate
No Challenger can become promotion-eligible from a single backtest or a single favorable regime.

---

## Sprint 7 — Intelligence Quality & Calibration

### Goal
Measure whether Black Oracle is becoming a better forecaster, not just a more profitable simulator.

### Required analysis
- Brier score
- reliability / calibration curve
- probability buckets
- confidence buckets
- regime buckets
- time-horizon buckets
- persona-level calibration
- debate-before vs debate-after calibration
- dissent usefulness rate

### Core question
`Does better Oracle judgment reliably improve downstream decision quality?`

### Exit gate
The system can quantify whether Adaptive Council changes improved forecast calibration out-of-sample.

---

## Sprint 8 — Live Readiness

### Goal
Prepare approval-gated spot execution without granting autonomous live authority.

### Scope
- exchange authentication with minimum required permissions
- no withdrawal permission
- approval UI
- deterministic risk gate
- reconciliation
- kill switch
- connectivity failure handling
- secret rotation procedure
- live/paper state separation

### Approval proposal format
Every proposed trade must show:
- market
- side
- notional
- confidence
- thesis
- dissent
- risk result
- stop
- target
- invalidation
- approve / reject

### Exit gate
All of the following must pass:
- sufficient Paper sample
- positive expectancy after costs
- drawdown within limits
- duplicate orders = 0
- reconciliation errors = 0
- kill switch tested
- disconnect recovery tested
- risk engine cannot be bypassed
- no withdrawal permission

Failure of any gate => NO GO.

---

## Sprint 9 — Conditional Small Live Pilot

This sprint has no calendar commitment. It starts only after Sprint 8 exits successfully.

### Boundary
- SPOT only
- leverage 0
- no margin
- no futures
- no shorting
- no martingale
- no pyramiding

### Risk envelope
- single-position allocation <= 2% of assets
- daily max loss = 1%
- total drawdown 5% => system halt

### Initial mode
Human approval required for live entries and exits unless a later, separately approved safety review changes this boundary.

---

## Priority lock

### P0 — Build a real product
`Sprint 0 -> Sprint 1 -> Sprint 2`

### P1 — Make judgment auditable and adaptive
`Sprint 3 -> Sprint 4`

### P2 — Scale controlled experimentation
`Sprint 5 -> Sprint 6 -> Sprint 7`

### P3 — Consider capital deployment
`Sprint 8 -> Sprint 9`

Do not skip forward to Strategy Factory, autonomous live execution or large strategy populations before P0 reliability is proven.

---

## Sprint operating template

Every sprint should be managed as:

1. Goal
2. Scope
3. Tasks
4. Implementation
5. Automated validation
6. Preview / Paper observation
7. Defect review
8. Exit gate
9. Decision: PASS / EXTEND / ROLLBACK
10. Next sprint

A sprint is not complete because code was written. It is complete only when the exit gate has been observed and recorded.