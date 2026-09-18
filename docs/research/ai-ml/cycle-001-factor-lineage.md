# Cycle 001 — AI/ML Factor Lineage

Date: 2026-09-19

## AIML-001 — Trajectory-level factor research

**Source:** Zhu et al. (2026), *AlphaSeek: Trajectory-Level Self-Iterative Factor Mining Framework for Multi-Source Financial Data*, arXiv:2608.13913.

**Evidence:** B. Recent primary research with reported CSI300 experiments and cross-market tests; it is not sufficient evidence of live robustness or Korean-market portability.

### Transferable idea
Treat the full research trajectory — hypothesis, construction, validation, backtest and feedback — as the unit of evolution. The framework also uses parallel expansion/mutation/crossover and redundancy-aware interaction with an existing factor library.

### BLACK ORACLE fit
This aligns with Strategy Factory / Genome / Experiment Ledger. The useful candidate is the lineage and redundancy mechanism, not copying the paper's factors or headline results.

### Hypothesis H-AIML001
At a fixed candidate and validation budget, lineage-aware generation with a redundancy gate will produce more distinct candidates that survive out-of-sample validation than unconstrained generation.

### Experiment EXP-AIML001
Offline research sandbox only. Freeze a feature universe and compare two candidate-generation policies: baseline unconstrained generation versus trajectory lineage plus similarity/redundancy filtering. Keep candidate count, compute budget and validation protocol constant.

### Metrics
OOS survival rate, pairwise signal similarity/correlation, unique accepted candidates per research budget, turnover, rejection reasons, and evidence completeness.

**Decision:** `TEST`. No automatic promotion to Paper/Production until the validation layer accepts the candidate.
