# BLACK ORACLE — Sprint 5R Terminal Release Contract

Status: **DRAFT / PAPER ONLY**  
Parent: `sprint/5-evidence-governed-validation-closure`  
Release goal: **Evidence-governed Crypto PAPER E2E v1 with a log-first operator terminal and research-grade surveillance**

## 1. Sprint objective

Sprint 5R is not a cosmetic redesign. It closes the gap between the trading system that makes decisions and the interface used to supervise those decisions.

The operator must be able to reconstruct this chain from persisted state:

`Market → Technical Candidate → Evidence → Scenario → Council → Risk → PAPER Decision → Execution/NO_TRADE → Outcome → Validation → Grade`

A new PAPER entry must never be presented as valid merely because technical signals are strong. Evidence, governance and deterministic risk remain separate gates. Protective exits remain deterministic and available even when Evidence or Council state degrades.

## 2. Product identity

BLACK ORACLE is operated as an **investment research, trading validation and supervision OS**, not as a generic AI dashboard.

Primary operator information architecture:

1. `MON` — Monitor
2. `POS` — Positions
3. `AUD` — Audit
4. `LAB` — Validation / Research

Legacy orbital, spatial and conversational surfaces are not primary operator navigation. They may survive only as advanced research visualizations when they expose real persisted relationships.

## 3. Interface contract

### Monitor

Purpose: answer, within seconds, “What is the system doing, what changed, what is at risk, and why?”

Required surfaces:
- PAPER/system state
- cycle number and freshness
- active Evidence count
- audit completeness
- validation state
- equity / cash / P&L / drawdown / open positions
- equity curve
- risk/validation matrix
- chronological decision/event log
- server-calculated PAPER readiness grade and direction of change

### Positions

Purpose: inspect one market/position without leaving its trading context.

Required tabs:
- Overview
- Evidence
- Scenario
- Council
- Risk
- History

Forecast, Council and Evidence are contextual inspection layers, not independent top-level products.

### Audit

Purpose: make every retained decision reconstructable.

Required trace dimensions:
- market context
- technical trace
- risk gate
- Evidence
- forecast/scenario
- Council
- execution trace
- outcome

Missing provenance is shown as `MISSING`, `NOT LINKED`, `UNAVAILABLE` or equivalent. It is never synthesized for presentation.

### Lab

Purpose: separate research/validation from execution authority.

Required surfaces:
- historical blind/no-lookahead validation
- walk-forward folds
- conventional Monte Carlo stress
- block/regime-preserving Monte Carlo
- Expected Shortfall / tail risk
- Deflated Sharpe Ratio
- Probability of Backtest Overfitting when a valid multi-strategy panel exists
- Strategy Factory prospective panel accumulation/progress
- forecast/Council calibration metrics
- Council v1/v2 prospective comparison
- integrity coverage/incidents
- promotion gates
- Evidence coverage
- audit quality
- deployment/readiness preflight
- scheduler policy
- PAPER readiness grade

## 4. UI Truth Contract

Every operator value must resolve to persisted or reproducibly derived state.

Allowed path:

`Persisted runtime / ledger / event → API contract → view model → terminal UI`

Forbidden path:

`UI convenience → invented confidence / invented probability / synthetic execution state`

When data does not exist, display unavailability explicitly. `INSUFFICIENT_DATA` is a valid and preferred result over a fabricated score.

## 5. PAPER execution authority

### New entries

Candidate ENTER is preserved only when:
1. market/technical candidate exists,
2. structured external Evidence is fresh and sufficient,
3. Scenario set is persisted,
4. authoritative Council v1/governance does not oppose the candidate,
5. deterministic Risk approves,
6. portfolio/correlation/capacity gates pass.

Otherwise the result is auditable `NO_TRADE`.

### Existing positions

Protective exits do **not** depend on Evidence availability.

Stop-loss, take-profit and other deterministic protective exits retain authority if Evidence refresh fails, becomes stale or governance degrades.

## 6. Council policy

### Council v1 — authoritative PAPER governance

Council v1 remains the execution-governance reference for Sprint 5R. Council output itself has `executionAuthority=false`; deterministic policy code decides whether the existing execution decision is preserved or blocked.

### Council v2 — challenger only

Council v2 runs independent specialist passes:
- `MARKET_STATE`
- `EVIDENCE_EVENT`
- `LIQUIDITY_REGIME`
- `RISK_EXECUTION`
- `FALSIFIER`

Synthesis preserves dissent, falsification pressure and unresolved uncertainty. Council v2 has:
- `executionAuthority=false`
- `promotionAuthority=false`

Every PAPER market cycle may record a same-time v1/v2 observation from the same market/evidence/liquidity context. The PAPER decision still uses v1 only.

After a fixed four-hour horizon, retained market history resolves those observations without lookahead. Comparison includes:
- favorable rate
- mean directional utility
- directional Brier proxy
- disagreement count
- v2 win rate on disagreement

`V2_PROMOTION_CANDIDATE` is only an analytical label after minimum sample and disagreement gates plus multi-metric improvement. It grants no execution or promotion authority and still requires explicit human review.

## 7. Black Oracle Grade Engine v0.2

Canonical notation explicitly preserves plus / zero / minus across every family:

`AAA+ / AAA0 / AAA- / AA+ / AA0 / AA- / A+ / A0 / A- / BBB+ / BBB0 / BBB- / BB+ / BB0 / BB- / B+ / B0 / B- / CCC+ / CCC0 / CCC- / CC+ / CC0 / CC- / C+ / C0 / C- / D+ / D0 / D- / F+ / F0 / F-`

Grades are never assigned by intuition. The engine first calculates a weighted 0–100 composite and confidence/coverage, then translates the result to a grade. Hard gates cap the maximum allowed grade.

The first operational rating is **PAPER Readiness**, derived from:
- Evidence coverage
- Audit completeness
- historical/OOS validation
- walk-forward validation
- Monte Carlo stress
- integrity coverage
- sample depth
- runtime health

Current numerical rating bands and gate thresholds are versioned governance defaults, not universal statistical claims. They must later be recalibrated from BLACK ORACLE's own validated experiment distribution.

A grade never grants execution authority.

### Grade Surveillance

PAPER Readiness is calculated server-side. The runtime checkpoint stores a bounded, backward-compatible grade history. The terminal reads `/api/trading-grade` instead of recomputing a separate client-side grade.

Surveillance records:
- final grade and raw score
- active hard-gate set
- confidence / coverage
- upgrade / stable / downgrade direction
- grade-step movement
- consecutive downgrade count
- cumulative downgrade-event count

Insignificant same-grade autosave observations are coalesced. Grade changes, material score changes, gate changes and periodic observations are retained.

## 8. Research-Grade Validation v2

Research metrics are evidence for review, not execution instructions.

### Deflated Sharpe Ratio

DSR adjusts a strategy's observed Sharpe for sample size, skewness, kurtosis and the number of tried configurations. `TRADING_RESEARCH_TRIAL_COUNT` must represent a defensible search-space lineage. If it is not configured, the API marks the source as `UNSPECIFIED_DEFAULT_1`; that default must not be interpreted as proof that only one strategy was tried.

### Probability of Backtest Overfitting

PBO requires aligned return histories for multiple comparable strategy configurations. A single strategy history is not enough.

Sprint 5R now persists a **prospective Strategy Factory shadow cohort** rather than fabricating a historical candidate panel. The default cohort contains one control plus eight bounded Genome variants. Every candidate receives the same PAPER-time technical, Evidence and liquidity context and produces only a research `ENTER` or `NO_TRADE` shadow prediction. These predictions never influence the real PAPER decision and keep `executionAuthority=false` and `promotionAuthority=false`.

Each cohort observation is resolved only after the fixed four-hour research horizon using the first retained market-history price at or after the target timestamp. Candidate return is the observed long return when that candidate predicted `ENTER`, otherwise zero for `NO_TRADE`. The aligned return panel therefore grows prospectively with no lookahead.

PBO remains `INSUFFICIENT_DATA` until at least three candidates and **60 fully aligned resolved observations** are available. When that gate closes, the API calculates PBO from the persisted cohort with source `PERSISTED_PROSPECTIVE_STRATEGY_COHORT`. The LAB terminal shows candidate count and `aligned / 60` progress.

The current evaluator is versioned `PROSPECTIVE_GENOME_PROXY_V1`. It is a controlled prospective candidate-comparison layer, not a claim that every Genome has already been replayed through a full independent broker/runtime implementation. A later Strategy Factory release may replace the proxy evaluator with a deeper candidate execution simulation after validation.

### Block / regime Monte Carlo

The v2 stress model samples moving return blocks within observed regimes before regime-stratified recombination. This preserves local serial dependence better than IID trade reshuffling, but does not assert that future regime dynamics are stationary.

### Expected Shortfall

VaR and Expected Shortfall are reported for closed PAPER trade returns and for the lower tail of block/regime stress terminal returns. Tail metrics remain sample-dependent and do not replace deterministic risk limits.

### Forecast / Council calibration

Resolved Council comparison observations produce Brier score, log loss and Expected Calibration Error for v1 and v2 top-scenario forecasts. Calibration remains unavailable until the minimum observation requirement is met.

## 9. Infrastructure boundary

Current preferred topology:

- GitHub: source control, CI, heavy research/validation jobs
- Vercel: web/operator UI and API façade
- Supabase Postgres: persistent PAPER runtime, ledgers, grade history and challenger observations
- Supabase Cron + Edge Function: PAPER orchestration

Do not migrate infrastructure simply for novelty. A replacement must demonstrate measurable benefit in reliability, cost, latency or operational capability.

Heavy statistical validation should not be moved into latency/CPU-constrained edge execution if GitHub Actions or another batch worker is a better fit.

## 10. Sprint 5R Hard Exit Gate

Sprint 5R is complete only when all of the following are true:

### Decision chain
- Evidence refresh precedes PAPER cycle in the reviewed scheduler lineage
- new ENTER fails closed without qualifying Evidence/governance/risk
- protective exits remain active during Evidence degradation
- Scenario/Council/decision/execution provenance is reconstructable
- Council v2 remains observation-only until deliberate promotion review
- Strategy Factory shadow candidates remain observation-only and never influence PAPER execution

### Operator terminal
- Monitor terminal works on desktop/mobile
- Positions inspector works on desktop/mobile
- Audit terminal works on desktop/mobile
- Lab terminal works on desktop/mobile
- server-side Grade Surveillance is visible
- Research Validation v2 is visible without inventing unavailable metrics
- Strategy Factory PBO panel progress is visible
- no document-level horizontal overflow
- no synthetic values or hidden missing links

### Validation
- dependency security gate PASS
- TypeScript PASS
- trading core tests PASS
- production build PASS
- Paper-cycle bundle smoke PASS
- Evidence-refresh bundle smoke PASS
- Trading-readiness bundle smoke PASS
- Grade API bundle smoke PASS
- Research-validation API bundle smoke PASS
- Supabase scheduler Edge bundle smoke PASS
- terminal desktop/mobile Playwright QA PASS

### Deployment
- exact Preview revision verified
- deployed operator QA PASS
- `/api/trading-readiness` reviewed
- explicit human PAPER rollout approval

No automatic production merge or scheduler rollout is authorized by this document.

## 11. Post-5R roadmap

### Sprint 6 — Research evidence accumulation
- accumulate Grade Surveillance history
- accumulate Council v1/v2 prospective observations
- accumulate at least 60 aligned Strategy Factory cohort observations so PBO becomes empirically available
- review whether `PROSPECTIVE_GENOME_PROXY_V1` should be replaced by deeper candidate execution simulation
- calibrate DSR search-space lineage from Experiment / Strategy Factory history
- extend execution-cost/slippage distributions

### Sprint 7 — Strategy Factory & empirical Council evaluation
- Strategy Genome lifecycle
- candidate generation/competition
- empirical PBO and DSR governance
- agent/lens contribution measurement
- Council calibration and disagreement value
- human-reviewed Champion/Challenger promotion

### Sprint 8 — PAPER qualification
- fresh post-release validation window
- stable Evidence/integrity coverage
- empirical grade history and downgrade surveillance
- strategy/portfolio qualification

### Sprint 9 — Small-Live Candidate architecture
Small-live remains a separately reviewed human-approved stage. No automatic transition from PAPER is allowed.
