# Cycle 004 — Probability of Backtest Overfitting and Research Budget

Date: 2026-09-20
Status: TEST
Research ID: EV-005
Production impact: None

## Executive summary

Cycle 002 introduced multiple-testing accounting and Deflated Sharpe diagnostics. Cycle 004 adds a complementary family-level question: **given all strategy variants tested, how likely is selection itself to have produced an in-sample winner that degrades out of sample?**

Bailey, Borwein, López de Prado and Zhu propose Probability of Backtest Overfitting (PBO) using Combinatorially Symmetric Cross-Validation (CSCV). Their published work explicitly targets investment backtests and argues that ordinary hold-out approaches can be unreliable for this model-selection problem.

Primary/archival sources:
- https://doi.org/10.21314/JCF.2016.322
- https://escholarship.org/uc/item/4w1110bb

Evidence quality: A- (peer-reviewed methodological research; still requires independent numerical reproduction before BO use).

## Relevance to BLACK ORACLE

Strategy Factory / Genome can generate large families of related candidates. Even if each candidate has an OOS metric, selecting the best among many trials can create a false sense of robustness. The existing Trial-family rule is therefore a prerequisite: rejected candidates must remain visible.

## Gap

BLACK ORACLE has no verified family-level PBO diagnostic yet. EV-003 covers multiple-testing/DSR, but DSR and PBO answer related rather than identical questions. They should not be collapsed into a single opaque score.

## Hypothesis

For intentionally over-searched synthetic strategy families, CSCV/PBO should flag materially higher selection-overfit risk than for a controlled family containing a stable injected signal. If it cannot distinguish those fixtures after implementation verification, it should not gate BO promotion.

## Experiment — EXP-EV005

1. Reproduce at least one published CSCV/PBO numerical example or author-provided result.
2. Create a null family of many noise strategies.
3. Create a positive-control family with a deliberately stable signal plus nuisance variants.
4. Record every candidate under one `research_family_id` in `bo.experiment.v1` lineage.
5. Compare PBO, DSR, OOS degradation and rank stability.

### Success metrics

- published/reference reproduction within documented numerical tolerance;
- full candidate count and family lineage preserved;
- null/over-searched family produces worse PBO evidence than positive control in the designed fixture;
- diagnostic remains separate from performance ranking;
- no production promotion rule until calibration behavior is understood.

## Decision

**TEST.** PBO is a candidate robustness diagnostic, not an alpha score and not yet a production gate.

## Research-budget implication

Every automated search should expose the effective research budget: number of candidates, parameter variants, feature combinations and selection rounds. Strategy Factory must not reset this history when a candidate is cloned, mutated or re-run.
