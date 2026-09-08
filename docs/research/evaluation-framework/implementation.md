# Black Oracle Evaluation Framework — Implementation Plan

## Phase 0 — Common Grade Engine (this branch)

Deliverables:
- common grade type and ordering
- weighted dimension aggregation
- coverage-aware confidence
- hard-gate grade caps
- grade transition direction
- deployment-state mapping
- unit tests
- research documentation

This phase intentionally does **not** claim that one fixed 0–100 mapping is statistically optimal. Initial rating bands are versioned governance defaults and will be recalibrated later from Black Oracle's empirical experiment population.

## Phase 1 — Performance Evaluator v2

Extend `performance.ts` with:
- annualized return where horizon permits
- volatility
- downside deviation
- Sharpe ratio
- Sortino ratio
- drawdown duration
- recovery duration
- benchmark return / excess return
- information ratio when benchmark data exists
- rolling-window performance
- regime/asset/horizon buckets
- bootstrap confidence intervals for expectancy, hit rate, and selected ratios

Output: `PerformanceSubgrade` plus raw metrics and uncertainty.

## Phase 2 — Strategy Statistical Validation

Add a strategy research ledger that records every tried configuration and supports:
- trial/search count
- strict in-sample vs out-of-sample separation
- walk-forward windows
- Deflated Sharpe Ratio
- Probability of Backtest Overfitting / CSCV
- benchmark comparison using Reality Check / SPA-inspired tests where applicable
- multiple-testing adjusted evidence

Output: `StatisticalRobustnessSubgrade` and hard gates.

## Phase 3 — Monte Carlo / Stress v2

Keep current trade-return bootstrap as one scenario family, then add:
- moving/block bootstrap
- regime-preserving bootstrap
- parameter perturbation
- transaction-cost distribution
- stochastic slippage / delay
- event-gap and crash shocks
- liquidity stress
- cross-asset / portfolio stress

Every run stores:
- seed
- input sample/version
- scenario family
- parameter distribution
- number of scenarios
- tail quantiles
- survival/ruin probability

Output: `StressSubgrade` and hard gates.

## Phase 4 — Forecast Evaluation v2

For `evidenceForecast.ts` and future model forecasts, persist forecast/outcome pairs and calculate:
- Brier score
- log loss
- calibration/reliability curve
- calibration error with uncertainty
- sharpness/resolution
- directional hit rate as a secondary metric
- metrics by asset × regime × horizon

The probability-generation formula should then be recalibrated empirically rather than remaining a fixed heuristic mapping.

Output: `CalibrationSubgrade` and forecast-model grade.

## Phase 5 — Risk Evaluator v2

Keep deterministic order-blocking gates in `risk.ts`. Add a separate statistical portfolio-risk layer with:
- Expected Shortfall
- tail-loss quantiles
- drawdown duration
- strategy/position risk contribution
- concentration
- correlation
- liquidity-adjusted exposure
- scenario stress loss

Output: `RiskSubgrade`. Critical risk failures remain execution-blocking and cannot be overridden by a high composite grade.

## Phase 6 — Indicator / Feature Evaluation

Every indicator or feature candidate is evaluated by incremental contribution rather than standalone popularity.

Required comparisons:
- base strategy without feature
- strategy with feature
- OOS change in expectancy and risk-adjusted return
- calibration/forecast improvement where relevant
- regime stability
- parameter stability
- redundancy/correlation with existing features
- transaction-cost impact

A feature that raises in-sample hit rate but degrades OOS expectancy is downgraded or removed.

Output: indicator grade by asset × regime × horizon.

## Phase 7 — Council Evaluation

Persist each agent's pre-debate view, evidence set, confidence, post-debate view, and realized outcome.

Evaluate:
- forecast calibration
- incremental decision value
- false-positive / false-negative avoidance
- risk avoidance value
- performance by domain
- performance by asset × regime × horizon

Also treat debate protocols as strategies:
- independent vote
- advocate vs skeptic
- evidence-first cross-examination
- weighted agent committee

Experiment Lab compares protocols and updates allowed council weights only through Champion–Challenger validation.

## Phase 8 — Rating Surveillance and Ledger

Persist rating snapshots so the UI can show:
- current grade
- subgrades
- confidence
- trend
- previous grade
- notch change
- downgrade streak
- rationale
- active gate caps
- rating version

All promotions/demotions must be reconstructable from the Ledger.

## Phase 9 — Router Integration

Replace globally fixed routing confidence thresholds with governed route policies informed by:
- strategy grade
- asset
- regime
- horizon
- forecast calibration
- data quality
- council grade
- risk state

`NO_TRADE` remains a first-class route.

## Phase 10 — Equity Expansion

The common Grade Engine is asset-agnostic. Equity-specific evaluators will add:
- fundamentals
- earnings surprise / revisions
- valuation
- corporate actions
- benchmark-relative performance
- sector/regime context
- market calendar / gap risk
- KRW/USD FX effects for cross-market portfolio evaluation

Crypto and equity share the evaluation language but not identical feature models or thresholds.

## Acceptance criteria for each future evaluator

No evaluator is considered complete until it has:
1. at least 10 reviewed references; 20–30 if evidence is contested
2. documented data contract
3. raw metric outputs
4. uncertainty/confidence handling
5. hard-gate policy where material
6. tests
7. Ledger lineage
8. explicit limitations
9. versioned thresholds/configuration
10. paper/out-of-sample verification before live use
