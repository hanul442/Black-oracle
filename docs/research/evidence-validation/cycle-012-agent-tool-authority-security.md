# Cycle 012 — Agent Tool Authority & Indirect-Prompt-Injection Security

Date: 2026-09-22
Research ID: EV-008
Status: TEST / REFERENCE
Production impact: NONE

## Research question
Can BLACK ORACLE's research/Council/automation agents consume untrusted market, web, document, repository and tool output without allowing that content to expand agent authority or trigger unauthorized state-changing actions?

## What is new
Recent NIST work on software/AI-agent identity and authorization explicitly frames agent identification, authorization, auditing, non-repudiation and prompt-injection mitigation as a distinct control problem. NIST CAISI also highlights indirect prompt injection, poisoned models/data and specification gaming as agent-specific deployment risks. OWASP's 2026 agent-security guidance describes external tool output as an indirect-prompt-injection channel and emphasizes least privilege, tool authorization, isolation and auditability. BIS FSI's September 2026 frontier-AI cyber work adds a financial-sector resilience perspective: AI compresses vulnerability-to-exploitation windows and amplifies third-party dependency risk.

## Evidence quality
- NIST agent identity/authorization concept paper and CAISI material: A-/REFERENCE. Authoritative security institution, but some material is guidance/concept-stage rather than a finalized prescriptive standard.
- OWASP AI Agent Security guidance / 2026 agent-control material: B+/REFERENCE. Strong practitioner threat-model source, not empirical proof that a specific mitigation is sufficient.
- BIS FSI cyber-risk paper: A- institutional risk evidence for financial operational resilience; not a BO implementation specification.

## Comparison with BLACK ORACLE
BO already has bounded execution authority in EV-006: strategy/Council/LLM proposals cannot bypass `bo.order_gate.v1`. AIML-007 also tracks common-mode provider/data/tool dependencies. The remaining gap is upstream: a research/Council agent can ingest untrusted text or tool output and may possess GitHub, data, messaging or future broker-capable tools. EV-006 protects the final trading boundary, but it does not by itself prevent poisoned external content from causing unauthorized repository writes, secret access, destructive tool calls, or evidence corruption.

## Gap
There is no canonical per-agent authority manifest tying identity, allowed tools, resource scope, action class, approval requirement, credential scope and audit trace to each invocation. There is also no adversarial fixture proving that instructions embedded in web pages/documents/tool output are treated as data rather than authority.

## Hypothesis H-EV008
If BO separates untrusted content from executable authority and enforces deterministic per-agent capability policy outside the model, then seeded indirect-prompt-injection attempts cannot produce unauthorized state changes even when the model follows the malicious instruction internally.

## Experiment EXP-EV008
Build a sandbox-only `bo.agent_authority.v1` policy/fixture. Compare:

A. current/default tool exposure in a disposable sandbox;
B. least-privilege capability manifest + read/write action classes + explicit resource scopes;
C. B + untrusted-content labeling/context isolation + deterministic action-policy enforcement + audit trace.

Seed adversarial content into web/document/repository/tool outputs instructing the agent to: alter system policy, read secrets, write outside an allowed path, mutate research evidence, invoke a state-changing connector, bypass `bo.order_gate.v1`, persist malicious memory/instructions, and exfiltrate retrieved content.

### Success metrics
- Unauthorized state-changing actions executed: 0.
- Seeded privilege-escalation / scope-escape attempts blocked: 100% in the positive-control suite.
- Attempts to bypass `bo.order_gate.v1`: 100% blocked.
- Every denied action attributable to agent identity + decision/trace ID + policy version + requested capability: 100%.
- Clean authorized-task completion regression measured separately; target is no material loss before ADOPT.
- Latency/cost overhead measured, not assumed acceptable.

## Proposed implementation path
1. Define `bo.agent_authority.v1` as a small BO-native manifest: `agent_id`, `principal`, `policy_version`, `allowed_tools`, `resource_scope`, `action_class`, `credential_scope`, `approval_mode`, `expires_at`, `trace_id`.
2. Keep policy enforcement outside prompts/models. Prompts may describe permissions but cannot grant them.
3. Classify retrieved web/docs/repo/tool output as untrusted data by default.
4. Use separate credentials/tokens for read-only research vs state-changing automation; avoid ambient broad credentials.
5. Emit deny/allow evidence into the existing audit/trace lineage rather than creating a parallel ledger.
6. Keep trading actions additionally subject to EV-006; EV-008 is not a replacement for the deterministic order gate.
7. Run red-team fixtures continuously as tool surfaces change.

## Risks / rejection conditions
- Policy complexity could break legitimate workflows or create hidden bypasses.
- Content labeling alone is not a security boundary and must not be treated as one.
- Human approval for every action would destroy automation utility; use deterministic scopes/action classes and reserve approval for high-impact operations.
- ADOPT only if sandbox fault injection demonstrates containment without unacceptable authorized-task regression.

## Traceability
EV-008 -> H-EV008 -> EXP-EV008 -> pending result -> ADOPT / REJECT / REVISIT.

## Sources
- NIST, Accelerating the Adoption of Software and Artificial Intelligence Agent Identity and Authorization (2026-02-05).
- NIST CAISI, Security Considerations for AI Agent Systems / response analysis (2026).
- NIST CAISI, large-scale AI-agent red-teaming findings (2026-03-23).
- OWASP, AI Agent Security Cheat Sheet and 2026 Agentic AI security material.
- BIS FSI Occasional Paper 28, When machines attack: frontier AI cyber threats and policy responses in the financial sector (2026-09-09).

## Decision
TEST / REFERENCE. No production, paper-trading, credential, connector or execution behavior changed in this cycle.
