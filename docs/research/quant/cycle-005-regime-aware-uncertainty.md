# Cycle 005 — Regime-aware uncertainty calibration

Date: 2026-09-20
Research ID: Q-001
Status: TEST
Experiment: EXP-Q001
Production impact: None

## Research question
Can BLACK ORACLE attach calibrated uncertainty to forecasts and Council-facing probabilities without assuming stationary/exchangeable market data?

## Source and evidence
Oancea (2026), *Dynamic Regime-Aware Conformal Calibration for Reliable Economic Forecast Intervals under Multiple Distribution Shifts* (arXiv:2608.17079). The paper evaluates 48 macro, energy and daily financial series and compares six baselines. It reports nominal 90% coverage of 0.890 for DRACP and stronger worst-series coverage, while a strongly-adaptive online conformal baseline produces narrower intervals. Evidence grade: B — recent substantive empirical/theoretical preprint, not yet treated as production proof.

A 2026 benchmark/review of conformal methods for time series reinforces the core issue: sequential dependence and distribution shift violate the exchangeability assumptions behind standard conformal prediction. Evidence grade: B.

## Relevance to BLACK ORACLE
BLACK ORACLE already has Forecast, Council, regime-aware routing and calibration concepts, but the research ledger does not yet define an uncertainty contract that survives regime change. A point forecast or raw model probability can look precise while being badly miscalibrated exactly when volatility/regime changes matter most.

## Gap
The current R&D architecture tracks evidence lineage and point-in-time data, but does not require forecast artifacts to carry target coverage, empirical coverage by regime/horizon, interval width/score, calibration-window identity, or calibration method/version.

## Hypothesis
A regime-aware or strongly-adaptive conformal layer will reduce conditional coverage failure during detected distribution shifts versus static split conformal calibration, without unacceptable interval inflation.

## EXP-Q001
Use archived forecasts only; do not alter live/paper decisions.

Baselines:
1. Uncalibrated model interval/probability where available.
2. Static split conformal.
3. Strongly-adaptive online conformal baseline.
4. Regime-aware weighted calibration candidate.

Stratify by asset class, forecast horizon, volatility regime and trend/liquidity regime where sample size permits.

### Success metrics
- empirical coverage vs nominal coverage
- worst-regime coverage gap
- mean interval score / interval width
- coverage after regime transitions
- calibration latency and compute cost
- stability across rolling windows

Promotion requires improvement in worst-regime calibration without merely achieving coverage through unusably wide intervals. No alpha/performance claim is inferred from calibration quality.

## Proposed BO contract
Extend `bo.experiment.v1` forecast artifacts with an optional `uncertainty` envelope:
- method + version
- target coverage
- calibration window/snapshot hash
- regime definition/version
- empirical coverage by horizon/regime
- interval score/width
- fallback behavior when calibration support is insufficient

## Risks
- Regime labels can themselves overfit.
- Coverage does not imply profitable forecasts.
- Sparse regimes can make conditional metrics unstable.
- The 2026 DRACP result is a preprint and should be reproduced independently.

## Decision
TEST. Reproduce before any adoption. The likely durable BO design principle is to treat uncertainty calibration as a separately versioned evidence artifact, not as a hidden property of a forecast model.

## References
- Oancea, B. (2026), arXiv:2608.17079.
- Sabashvili, A. (2026), arXiv:2601.18509.
