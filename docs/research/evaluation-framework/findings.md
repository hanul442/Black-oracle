# Black Oracle Evaluation Framework — Findings

## Executive finding

The current trading stack already measures useful operational and paper-trading outputs, but the evaluation layer is still closer to a rule-based scorecard than a research-grade validation system. The next architecture should separate raw performance, statistical evidence, model reliability, tail risk, calibration, and deployment governance before assigning a grade.

## Current implementation strengths

### `performance.ts`
Current paper-performance aggregation already records:
- trade count and win/loss/breakeven counts
- win rate
- gross profit/loss and net PnL
- expectancy
- average win/loss
- payoff ratio
- profit factor
- average and total return
- maximum/current drawdown
- score buckets by entry Oracle Trade Score

This is a useful base for descriptive performance analytics.

### `monteCarlo.ts`
Current Monte Carlo validation already includes:
- bootstrap resampling with replacement
- deterministic seeding
- configurable scenario counts up to 20,000
- cost inflation
- adverse shock
- winner haircut / loser amplification
- terminal-return distribution
- drawdown distribution
- survival, ruin, and profitability probability
- PASS / WATCH / REJECT / INSUFFICIENT_DATA verdicts

This is a valid first stress layer.

### `evidenceForecast.ts`
The forecast layer already exposes:
- bullish / bearish probabilities
- confidence and uncertainty
- contradiction counts
- evidence IDs
- auditable reasons

This is structurally compatible with future probabilistic forecast evaluation.

### `strategyRouter.ts`
The router already has:
- explicit `NO_TRADE`
- regime-aware routing between trend/momentum and mean reversion
- evidence/technical alignment tracking
- reasons for routing decisions

This provides the right place to later inject empirical strategy grades by asset × regime × horizon.

### `risk.ts`
The risk gate already blocks orders for:
- invalid account/notional state
- position-size breaches
- daily loss limit
- total drawdown limit
- disconnected/stale feeds
- ledger mismatch
- duplicate orders
- excessive estimated slippage

This deterministic safety layer should remain even after statistical risk models are added.

## Critical gaps

### 1. Performance metrics are descriptive, not inferential
Missing or underdeveloped items include:
- Sharpe / Sortino and downside deviation
- drawdown duration / recovery time
- benchmark-relative return and information ratio
- confidence intervals around hit rate, expectancy, and profit factor
- sample-size sufficiency
- stability by market regime, asset, and time horizon
- performance attribution by indicator, evidence source, council agent, and setup

### 2. Strategy search is not protected enough against false discovery
When thousands or tens of thousands of candidate strategies are tested, the best historical result can be a statistical accident. The evaluation layer therefore needs:
- complete trial-count / search-space lineage
- Deflated Sharpe Ratio
- Probability of Backtest Overfitting
- Reality Check / Superior Predictive Ability style benchmark comparison
- explicit multiple-testing penalties
- strict out-of-sample and walk-forward gates

### 3. Current Monte Carlo is mainly IID trade-return bootstrap
The current implementation randomly resamples individual trade returns. This does not preserve important serial or regime structure. Future validation should add separate engines for:
- block bootstrap / stationary bootstrap
- regime-preserving resampling
- parameter perturbation
- execution-cost distributions rather than one fixed cost stress
- signal-delay and slippage distributions
- market shock libraries
- cross-asset correlation stress
- strategy-combination / portfolio Monte Carlo

The existing IID bootstrap should remain as one test, not be treated as the whole Monte Carlo layer.

### 4. Forecast probability is heuristic rather than empirically calibrated
`evidenceForecast.ts` currently transforms evidence score and confidence into bullish/bearish probabilities through a deterministic formula. This is useful as a placeholder but does not prove that a 70% forecast occurs approximately 70% of the time.

Needed metrics:
- Brier score
- log loss / log score
- reliability / calibration curve
- calibration error with uncertainty intervals
- sharpness / resolution
- outcome frequency by probability bucket
- calibration by asset × regime × horizon

### 5. Risk is mainly rule-based rather than portfolio/tail-aware
The deterministic gates are valuable, but the system still needs:
- Expected Shortfall
- tail-loss distribution
- drawdown duration and recovery
- risk contribution by position/strategy
- concentration and correlation
- liquidity-adjusted risk
- stress loss by scenario
- portfolio-level exposure limits

### 6. Router thresholds are hard-coded rather than learned
Examples include the fixed 62% multi-timeframe entry threshold and fixed routing criteria. These should eventually become governed parameters supported by Experiment Lab results and should vary by:
- asset
- regime
- horizon
- data quality
- strategy grade
- council confidence

### 7. A single score is insufficient
A strategy with high return but poor robustness must not look equivalent to a lower-return strategy with strong out-of-sample and stress performance. Black Oracle therefore needs both:
- `Overall Grade`
- mandatory `Subgrades`

Proposed subgrade families:
1. Performance
2. Risk
3. Out-of-Sample
4. Statistical Robustness
5. Monte Carlo / Stress
6. Regime Stability
7. Forecast Calibration
8. Evidence Quality
9. Execution Quality
10. Data Quality
11. Model Governance / Reproducibility

## Core design principle

**Scores rank; gates protect.**

The weighted score should distinguish strong candidates from weak candidates, but critical validation failures must cap the maximum grade regardless of return. Example: an in-sample strategy can score like AAA on raw performance, but without out-of-sample validation its deployable grade can be capped at BBB or lower according to policy.

The exact gate thresholds must be versioned and later recalibrated using Black Oracle's own historical experiment distribution. They should not be presented as universal statistical facts.
