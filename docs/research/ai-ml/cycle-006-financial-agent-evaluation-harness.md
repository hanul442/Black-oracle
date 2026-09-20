# Cycle 006 — Financial Agent Evaluation Harness

Date: 2026-09-20
Status: TEST
Research ID: AIML-005
Experiment: EXP-AIML005

## Executive summary
BLACK ORACLE's Council, research agents, and future specialist agents should not be promoted on generic LLM quality or anecdotal demos. Recent finance-agent benchmarks converge on a stronger pattern: evaluate the complete tool-using workflow, preserve execution traces, use task-specific rubrics, and separate factual retrieval from open-ended investment research quality.

## Sources reviewed
- FinRetrieval (2026): 500 structured financial retrieval questions, 14 agent configurations, complete tool-call traces. Its central result is that tool access/harness design can dominate model choice; structured financial APIs materially outperform web-only retrieval in the reported benchmark.
- Deep FinResearch Bench (2026): evaluates professional investment research on qualitative rigor, quantitative forecasting/valuation accuracy, and claim credibility/verifiability.
- FrontierFinance (2026): 220 expert-crafted investor-workflow queries and 11,543 source-attributed rubrics across six use cases; reports strong sensitivity to the tool harness and persistent weakness in screening/discovery and sector/macro work.
- FORCE-Bench (2026): 251 expert-annotated operational-finance queries scored across accuracy, citations, clarity, depth, groundedness, recency, relevance, and structure.
- FINOS AI Evaluation & Benchmarking framework: industry-oriented reference for operationalizing financial AI evaluations and AgentOps.

## Evidence quality
B+ overall. The 2026 benchmarks are recent and task-relevant, several release datasets/evaluation code/traces, but many are preprints and their reported leaderboards should not be treated as universal model rankings. The reusable evidence is the evaluation architecture, not any single model score.

## Gap vs BLACK ORACLE
BO already has Council provenance and Experiment Ledger candidates, but lacks a canonical evaluation suite for agent promotion. Without it, changing prompts/models/tools can improve one visible example while degrading retrieval accuracy, citation fidelity, recency, cost, latency, or tool discipline elsewhere.

## Proposed BO application
Create a versioned `bo.agent_eval.v1` manifest linked to `bo.experiment.v1`:
- eval_suite_id / task_id / task_family
- frozen input + allowed information cutoff
- required/allowed tools
- model, prompt, router and tool versions
- source/citation ground truth where objective
- execution trace ID
- deterministic metrics where possible
- rubric version + judge version where subjective
- latency, token and monetary cost
- failure taxonomy
- result artifact hash

Initial BO task families:
1. Structured market/fundamental retrieval
2. Evidence-backed company/sector research
3. Forecast/Council evidence synthesis
4. Strategy explanation and risk disclosure
5. Tool selection/routing
6. Time-bounded freshness/recency
7. Adversarial missing/conflicting evidence

## Hypothesis
A fixed BO finance-agent evaluation harness will detect regressions and tool-routing failures that are invisible in prompt-level spot checks, while allowing cheaper model/tool configurations to be promoted when quality remains inside defined tolerances.

## EXP-AIML005
Build 30-50 internal tasks from archived BO workflows. Keep objective retrieval tasks separate from rubric-scored synthesis tasks. Run current Council/Research configuration as baseline, then one challenger configuration.

### Success metrics
- objective retrieval exact/numeric accuracy
- citation entailment / source correctness
- unsupported-claim rate
- recency compliance
- required-tool success and invalid-tool-call rate
- task completion rate
- p50/p95 latency
- cost per completed task
- rubric inter-run stability
- regression count by task family

## Decision
TEST. Do not use external benchmark leaderboards to choose a production model directly. Reuse their task/rubric/trace patterns to build BO-specific evaluation fixtures.

## Risks
Benchmark contamination, LLM-judge variance, stale ground truth, overfitting to a small internal suite, and conflating research quality with trading profitability. Trading promotion remains governed by separate evidence/validation gates.

## References
- https://arxiv.org/abs/2603.04403
- https://arxiv.org/abs/2604.21006
- https://arxiv.org/abs/2608.11683
- https://arxiv.org/abs/2607.19409
- https://github.com/finos-labs/ai-evals-framework
