# BOT-S3 Research Record — Canonical Validation Experiment Manifest

Date: 2026-09-21
Status: **IMPLEMENTED / TEST GATE**

## Research → Hypothesis → Experiment → Result → Adopt/Reject

### Research
- **DI-001:** canonical experiment identity should bind code/config, data identity, splits, assumptions and outputs rather than proliferating independent ledgers.
- **DI-003:** point-in-time availability must be explicit for any feature/data used in historical validation.
- **DI-004:** stable snapshot identity is required for later reproduction and Decision Replay.
- **EV-001:** engine identity/version is a reproducibility dimension independent of strategy performance.
- **Q-002:** fees, spread and slippage are explicit model-risk inputs and must not be hidden in engine defaults.

### Hypothesis
A single immutable manifest with fail-closed identity, time, split, stage, execution-assumption and authority gates will reduce validation ambiguity before any new Strategy Factory expansion.

### Experiment
Implement `bot.validation-experiment.v1` as an additive contract and test rejection of:
- missing stable identities,
- non-point-in-time-safe data,
- invalid or overlapping train/OOS windows,
- incomplete/duplicate validation stages,
- invalid fee/spread/slippage assumptions,
- promotion/execution/capital authority escalation.

### Result
Implementation is present on `bot-s3-validation-manifest`; CI is the current verification gate.

### Disposition
**ADOPT-SCHEMA-CANDIDATE**, contingent on repository CI. This contract does not claim that any strategy is valid and grants no promotion, execution or capital authority.

## Next experiment
After CI green and merge, define stage-result records linked to this manifest so Backtest/OOS/Walk-Forward/Monte Carlo/execution-cost results can be compared without changing the manifest or silently promoting a candidate.
