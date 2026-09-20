# Cycle 007 — Council Coordination Ablation

Date: 2026-09-21
Research ID: AIML-006
Status: TEST
Experiment: EXP-AIML006
Production impact: None

## Executive summary
Recent financial multi-agent research strengthens a concern that matters directly to BLACK ORACLE: adding agents or using a larger model does not by itself prove that Council coordination adds value. A 2026 survey of financial multi-agent systems proposes the Coordination Primacy Hypothesis (CPH), while explicitly stating that it remains falsifiable rather than established. A separate 2026 Japanese-equity study reports that fine-grained task decomposition and alignment between intermediate analytical outputs and downstream decision preferences can improve risk-adjusted performance under its tested protocol.

BLACK ORACLE should therefore treat Council topology, task decomposition, aggregation and disagreement handling as experimental variables. The system must be able to compare a Council against simpler baselines under the same information cutoff, tool budget, model family, execution assumptions and evaluation harness.

## Sources
1. Nguyen & Pham (2026), *Toward Reliable Evaluation of LLM-Based Financial Multi-Agent Systems: Taxonomy, Coordination Primacy, and Cost Awareness*, arXiv:2603.27539.
2. Miyazaki et al. (2026), *Toward Expert Investment Teams: A Multi-Agent LLM System with Fine-Grained Trading Tasks*, arXiv:2602.23330.
3. Yao & Zheng (2026), *Beyond Agent Architecture: Execution Assumptions and Reproducibility in LLM-Based Trading Systems*, arXiv:2606.08285.

## Evidence assessment
- CPH survey: B. Useful synthesis and falsifiable framing, but not definitive causal validation.
- Fine-grained task decomposition study: B. Direct empirical relevance and leakage-controlled protocol, but external market/task transfer to BO is unproven.
- Reproducibility audit: B. Strong methodological warning across 30 studies, but not a BO-specific experiment.

## BLACK ORACLE gap
BO already has Council, Forecast, Evidence Ledger, Strategy/Model Router and agent-evaluation research. The missing layer is a controlled Council ablation protocol. Without it, a richer Council may appear superior because it receives more tokens, tools, retries, context or latency budget rather than because coordination is useful.

## Testable hypothesis
Under matched information, tool, model and compute budgets, an explicitly coordinated Council produces better evidence-grounded decisions than a single-agent baseline and an uncoordinated multi-agent baseline.

## EXP-AIML006
Use the frozen BO finance-agent task suite from EXP-AIML005. Compare:

A. Single strong agent.
B. Parallel specialists + simple vote/aggregation.
C. Fine-grained specialist decomposition + explicit evidence handoff + arbiter.
D. Same as C but with disagreement-aware escalation / NO TRADE option.

Hold constant wherever feasible:
- information cutoff and dataset snapshot;
- allowed tools and retrieval corpus;
- model family;
- total token/compute budget bands;
- execution assumptions for trading tasks;
- task/rubric version.

Capture:
- numeric/task accuracy;
- citation correctness and unsupported-claim rate;
- calibration / abstention quality;
- downstream decision quality;
- cost and latency;
- tool failures/retries;
- disagreement rate;
- incremental value over the best simpler baseline.

For trading tasks, also calculate a BO-specific coordination breakeven measure: whether incremental Council value remains positive after incremental inference/research cost and any turnover/execution effects caused by Council decisions.

## Success criteria
Do not define a universal return threshold before baseline data exists. Promotion requires statistically and operationally credible improvement over the simpler baseline across multiple task families, with no material regression in unsupported claims or tail-risk behavior. If gains disappear after budget matching, reject the coordination mechanism rather than attributing value to 'multi-agent' architecture.

## Implementation candidate
Add a versioned `coordination_manifest` to agent-evaluation traces:
- topology/version;
- agent roles;
- task decomposition;
- handoff protocol;
- aggregation/arbiter rule;
- disagreement policy;
- NO TRADE/abstention policy;
- token/tool/latency budgets;
- trace IDs and evidence IDs.

This should reference, not duplicate, `bo.agent_eval.v1` and the canonical BO trace envelope.

## Risks
- Budget matching can be imperfect across architectures.
- LLM stochasticity requires repeated runs.
- Trading PnL is too noisy to be the sole evaluator.
- An LLM judge can favor verbose multi-agent traces; objective graders and human audit samples are required.

## Decision
TEST. Do not expand Council headcount or complexity merely because external multi-agent systems report gains. Require BO-specific ablation evidence first.
