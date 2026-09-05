# Black Oracle Evaluation Framework — Architecture Decision

Decision status: **ADOPT**

## 1. Rating language

Black Oracle uses the following custom ordinal grade scale:

`AAA+ / AAA / AAA- / AA+ / AA / AA- / A+ / A / A- / BBB / BB / B / CCC / CC / C / D+ / D / D- / F+ / F / F-`

This is a Black Oracle project convention. It is not an S&P, Moody's, Fitch, or other external rating methodology.

## 2. Rating object

Every rated object should eventually expose four top-level fields:

- `grade`
- `subgrades`
- `trend`
- `confidence`

Optional operational fields include:

- `deploymentStatus`
- `maxAllowedGrade`
- `gateFailures`
- `ratingVersion`
- `asOf`
- `sampleWindow`
- `reasons`

## 3. Rated entities

The common rating engine is intended to support:

1. Strategy
2. Indicator / feature
3. Forecast model
4. Evidence item / evidence source
5. Council agent
6. Council decision / debate protocol
7. Dataset / market-data feed
8. Experiment
9. Execution venue / execution quality
10. Portfolio / strategy ensemble

Each entity type can have its own subgrade calculator, but the final grade language and governance rules remain common.

## 4. Separation of layers

### Layer A — Raw metrics
Examples: return, hit rate, PnL, drawdown, Brier score, slippage, latency, evidence freshness.

### Layer B — Statistical validation
Examples: confidence intervals, sample sufficiency, benchmark comparison, DSR, PBO, Reality Check / SPA style tests.

### Layer C — Stress and robustness
Examples: Monte Carlo, parameter perturbation, cost stress, regime stress, liquidity stress, tail-risk statistics.

### Layer D — Normalized subgrades
Raw metrics are transformed into comparable 0–100 dimension scores using versioned, entity-specific policies.

### Layer E — Composite rating
A weighted score produces a **base grade**.

### Layer F — Hard gates
Validation failures can cap the maximum grade irrespective of the composite score.

### Layer G — Surveillance
Every rating change is stored so the system can evaluate rating momentum, downgrade velocity, and persistent deterioration.

## 5. Scores rank; gates protect

The system must never allow a high average score to hide a critical failure.

Examples of future hard gates:

- missing out-of-sample validation
- unacceptable probability of backtest overfitting
- non-positive out-of-sample expectancy
- Monte Carlo survival below policy threshold
- unresolved data leakage / look-ahead bias
- failed execution or ledger reconciliation controls
- critical data-quality failure

The numerical thresholds for these gates are policy parameters and must be versioned. The first implementation intentionally accepts externally prepared gates rather than pretending that universal thresholds have already been proven.

## 6. Deployment interpretation

Initial project policy:

- `AAA+` through `AA-` → **CHAMPION** candidate
- `A+` through `A-` → **CHALLENGER**
- `BBB` → **INCUBATOR / PAPER**
- `BB` or `B` → **EXPERIMENT ONLY**
- `CCC`, `CC`, `C` → **REJECT**
- `D+` through `F-` → **RETIRED / BLACKLIST candidate**

Deployment still requires explicit execution/risk authorization. A grade alone never grants live-trading authority.

## 7. Rating transitions

A rating without history is incomplete. Black Oracle will store rating snapshots and derive:

- upgrade / stable / downgrade
- notch change
- rolling downgrade count
- time since last upgrade/downgrade
- downgrade velocity
- recovery after downgrade

A strategy that falls `AA+ → AA → A+` is an early-warning case even if current PnL remains positive.

## 8. Confidence is separate from grade

A high grade with low confidence is not equivalent to a high grade with deep evidence.

`confidence` should reflect, at minimum:

- metric coverage
- sample depth
- uncertainty of estimated metrics
- data quality
- stability across validation windows

The first Grade Engine implementation computes coverage-aware confidence from supplied dimension confidences. More advanced confidence intervals and Bayesian/posterior uncertainty belong in later entity-specific evaluators.

## 9. Calibration principle

Forecasts must be judged as probability forecasts. Directional hit rate is secondary.

A forecast saying `70% bullish` should be assessed on whether similar forecasts historically realized near that frequency, using proper scoring rules and calibration diagnostics.

## 10. Multiple-testing principle

The Experiment Lab must record the search process itself:

- number of strategies tried
- parameter combinations
- feature subsets
- discarded variants
- training/validation splits
- optimization rounds

The system must not grade the surviving best strategy as if it were the only hypothesis tested.

## 11. Independence and reproducibility

For each model/strategy rating, the Ledger should eventually allow reconstruction of:

- code/strategy version
- input dataset version
- parameters
- experiment ID
- train/test windows
- metric calculations
- Monte Carlo seed/configuration
- evidence IDs
- council protocol and votes
- grade version
- promotion/demotion decision

This follows the model-risk principle that validation, limitations, use, and governance must be auditable and repeatable.
