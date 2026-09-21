# Cycle 009 — Common-Mode AI Dependency Risk

Date: 2026-09-21
Status: TEST / REFERENCE
Research ID: AIML-007
Experiment: EXP-AIML007
Production impact: None

## Research question
Does BLACK ORACLE's Council/Router obtain genuine robustness from multiple agents, or can shared model/provider/data/tool dependencies create correlated failure that only looks like diversity?

## New evidence
Recent BIS remarks on AI in finance emphasize concentration and herding risk: if many financial actors rely on a small number of foundation models or vendors, common errors or vulnerabilities can synchronize decisions under stress. BIS also highlights third-party/vendor dependence, explainability, data-security, adversarial vulnerability, and the need for meaningful human oversight. Earlier BIS financial-stability analysis similarly identifies speed, complexity, opacity and third-party dependence as channels through which AI can accelerate and obscure risk transmission.

Evidence quality: A- as institutional risk/governance evidence. These sources are not direct proof that BLACK ORACLE's agents will herd, and no external threshold or trading rule is adopted from them.

## Comparison with current BLACK ORACLE
AIML-006 already asks whether multi-agent coordination outperforms a single strong agent. That experiment is necessary but insufficient: several named specialists can still be a single failure domain when they share the same base model, provider, prompt ancestry, retrieval corpus, market-data feed or tool adapter.

Current gap: Council diversity is described primarily by agent role. BLACK ORACLE does not yet require evidence that its agents are independent along the dimensions that matter for common-mode failure.

## Hypothesis
H-AIML007: role-diverse agents sharing the same underlying dependencies will show materially higher error correlation and lower fault tolerance than a dependency-diversified configuration, especially under stale-data, provider-error, adversarial-evidence and regime-shift conditions.

## Experiment — EXP-AIML007
Run after AIML-005 freezes the BO-specific golden task set. Compare equal-budget configurations:

A. Single strong agent.
B. Role-diverse Council using one model/provider and shared retrieval/data path.
C. Same Council roles with selected model/provider diversity where operationally feasible.
D. C plus independent evidence/data cross-check and deterministic abstention/escalation gate.

Inject controlled faults independently and jointly:
- stale or missing primary market-data feed;
- corrupted/contradictory evidence item;
- one provider/model unavailable;
- tool adapter timeout or malformed response;
- prompt-injection-like evidence content in a sandbox corpus;
- regime-shift / out-of-distribution tasks;
- synchronized misleading narrative across multiple secondary sources.

## Metrics
Primary:
- pairwise error correlation between agents;
- common-mode failure rate;
- false-consensus rate;
- disagreement recall: fraction of seeded faults that trigger meaningful dissent;
- abstention/escalation precision and recall;
- task accuracy and unsupported-claim rate under fault injection.

Operational:
- p95 latency;
- inference/tool cost;
- provider outage tolerance;
- percentage of decisions retaining at least one independent evidence path.

## Success criteria
Do not set arbitrary production thresholds before a baseline exists. First establish confidence intervals for A/B/C/D on the frozen task set. A dependency-diversified architecture is promotable only if it reduces common-mode/false-consensus failures without unacceptable regression in accuracy, latency or cost. If diversity adds cost but no measurable resilience, reject it.

## Implementation candidate
Add a versioned `dependency_manifest` to agent-evaluation traces, not to live trading logic yet:

- model_family / model_version
- provider
- prompt_or_policy_version
- retrieval_corpus_id
- market_data_source_id
- tool_adapter_versions
- evidence_source_classes
- fallback_path

Add `failure_domain_id` labels so the evaluator can distinguish nominal role diversity from actual infrastructure/model diversity.

## Risks
- Artificial fault injection may not represent real correlated failures.
- Multiple providers can increase cost, latency, privacy surface and operational complexity.
- Different model names do not guarantee independent errors if training data or architecture is similar.
- Diversity must not become an excuse to weaken deterministic safety gates; `bo.order_gate.v1` remains independent of Council consensus.

## Decision
TEST / REFERENCE. Extend AIML-006 rather than creating a competing Council architecture. Do not change production or paper-trading behavior. No model/provider is promoted or removed based on this literature alone.

## Sources
- Bank for International Settlements, `Winning in the AI era - the new playbook for Indian banks`, 2026-09-07.
- Bank for International Settlements, `The financial stability implications of artificial intelligence and digital finance`, 2026-01-26.

## Traceability
AIML-007 → H-AIML007 → EXP-AIML007 → pending result → ADOPT / REJECT / REVISIT.
