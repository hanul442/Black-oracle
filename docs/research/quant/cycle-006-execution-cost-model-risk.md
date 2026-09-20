# Cycle 006 — Execution Cost Model Risk

Date: 2026-09-20
Status: TEST
Research ID: Q-002
Experiment: EXP-Q002

## Executive summary
BLACK ORACLE should treat execution-cost assumptions as a model family, not a scalar fee parameter. New 2026 work on RL trading environments reports that realistic nonlinear market-impact models can materially change both absolute performance and the relative ranking/behavior of trading algorithms. This is especially relevant before Autotrade or Strategy Factory candidates are promoted from research to paper/live execution.

## Source
Riera Abbade & Reali Costa (2026), *Realistic Market Impact Modeling for Reinforcement Learning Trading Environments*. The work implements Gymnasium-compatible environments with pluggable cost models based on Almgren-Chriss and the square-root impact law, permanent-impact decay and trade-level logging, and compares multiple DRL algorithms against fixed-bps assumptions.

## Evidence quality
B. Recent preprint with released implementation and explicit experiments, but not sufficient evidence to transplant its calibrated parameters into BO's Korean-equity or crypto execution. Use as methodology/reference, not as a universal market-impact calibration.

## Gap vs BLACK ORACLE
BO already recognizes fees/slippage/fill/latency in `bo.experiment.v1`, and EV-001 covers cross-engine implementation risk. The missing layer is a structured stress family for execution costs: fixed fees alone can hide turnover-sensitive strategies whose apparent alpha disappears under nonlinear impact, spread widening, partial fills, or latency.

## Proposed application
Define a storage-neutral `execution_model_manifest` linked to each strategy experiment:
- fee schedule/version
- spread model
- slippage model
- impact model + parameters/calibration source
- fill/partial-fill assumptions
- latency assumption
- liquidity/participation cap
- venue/session
- stress scenario ID

## Hypothesis
Strategies that remain promotable across a documented execution-cost stress family will have lower paper/live degradation than strategies selected under a single fixed-bps assumption.

## EXP-Q002
Select representative high-turnover and low-turnover KRX/crypto candidates. Re-run each under:
1. zero/diagnostic cost
2. current BO baseline cost
3. spread + fixed slippage
4. participation-sensitive nonlinear impact proxy
5. stressed liquidity/spread regime

Do not calibrate a live impact model from the paper. Use transparent scenario parameters first, then replace them with venue/data-derived estimates when available.

## Success metrics
- rank stability across cost models
- net Sharpe/Sortino and MDD
- turnover and participation rate
- cost as % gross alpha
- break-even cost/slippage
- trade rejection/partial-fill sensitivity
- performance degradation vs baseline

## Decision
TEST. Add execution-model identity to experiment evidence before Strategy Factory scales candidate generation. Production behavior remains unchanged.

## Risks
False precision from poorly calibrated impact parameters; crypto/KRX microstructure differences; insufficient order-book data; double-counting spread/slippage/impact; and optimizing strategies to the stress harness itself.

## Reference
- https://arxiv.org/abs/2603.29086
