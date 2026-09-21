# Cycle 008 — Market Neutrality as a Measured Constraint

Date: 2026-09-21
Status: REFERENCE / TEST
Research ID: Q-003
Experiment: EXP-Q003
Production impact: None

## Research signal
Belyakov (2026), *AlphaZeroBeta: deep reinforcement learning for market-neutral portfolios*, published in Financial Innovation on 2026-09-20, combines excess-return, benchmark-correlation and transaction-cost objectives and evaluates the policy with rolling walk-forward testing.

Evidence quality: B+. Peer-reviewed and newly published, but a single framework does not justify adopting its DRL architecture or reported strategy performance in BLACK ORACLE.

## What is new/relevant for BO
The useful idea is not “use PPO.” It is to treat intended portfolio properties such as market neutrality as **measured constraints with explicit violation diagnostics**, rather than relying on a strategy label like `market_neutral`.

## Gap
BO strategy metadata can describe strategy intent, but promotion evidence should separately prove realized exposures across regimes and stress periods. A strategy named market-neutral can still acquire persistent beta, sector/factor concentration or transaction-cost-driven behavior.

## Hypothesis
Promotion gates that measure realized exposure drift across rolling OOS windows will reject nominally neutral strategies that silently accumulate directional risk, without requiring adoption of the paper's RL model.

## EXP-Q003
For representative candidate strategies tagged neutral/hedged:
- estimate rolling market beta and benchmark correlation
- inspect gross/net exposure and concentration
- segment results by regime
- stress transaction-cost assumptions
- record constraint breaches as first-class evidence artifacts

Success metrics:
- exposure metrics reproducible from `bo.experiment.v1`
- explicit breach rate by OOS window/regime
- no strategy receives a neutrality label from configuration alone
- promotion decision can distinguish alpha performance from constraint compliance

## Decision
**REFERENCE / TEST.** Do not adopt the paper's DRL strategy. Adopt only the falsifiable validation idea after BO-specific replay evidence.

## Traceability
Q-003 → EXP-Q003 → OOS exposure diagnostics → ADOPT/REJECT/REVISIT.
