# Agent OS / AI-assisted R&D Reference Bundle

Status: **REFERENCE / TEST**  
Reference ID: **REF-PROD-002**  
Captured: **2026-09-23**  
Primary review: [Cycle 014 — Agent OS External Reference Review](../../research/ai-ml/cycle-014-agent-os-external-reference-review.md)

## Why this bundle exists

This note preserves the external references surfaced during a BLACK ORACLE reference-review session. The screenshots were discovery prompts, not evidence by themselves. Claims that matter for implementation are grounded in the official documentation, public repositories, or primary research linked below.

The bundle is intentionally cross-domain because its value is architectural: it suggests a coherent operating loop for agentic research and product development rather than seven unrelated features.

`Task → Skill Routing → Memory Retrieval → Tool Execution → Evidence → Council / Strategy → Evaluation → Observability → Memory Update`

## References

| Reference | Domain | BO use | Status | Source |
|---|---|---|---|---|
| Scientific Agent Skills | Agent architecture / research procedure | Skill Registry, versioned procedural knowledge, reproducible tool guidance | **ADOPT PATTERN / TEST IMPLEMENTATION** | [K-Dense repository](https://github.com/K-Dense-AI/scientific-agent-skills) |
| AgentMemory | Agent memory | inspectable long-term, daily, topic and scratchpad memory patterns | **ADOPT PATTERN / TEST IMPLEMENTATION** | [jayzeng/agentmemory](https://github.com/jayzeng/agentmemory) |
| Browser Use API v4 | Tool execution / research | browser fallback for workflows that cannot be handled reliably by APIs or structured feeds | **TEST** | [Browser Use Web Agent API](https://browser-use.com/web-agent-api) |
| VWAP deviation / mean-reversion reference | Quant R&D | Strategy Factory hypothesis candidate, not a trading rule | **TEST ONLY** | [SSRN: ADX-conditioned VWAP strategy](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6454659) |
| UI/UX Pro Max / Design Taste / Impeccable class of skills | Design workflow | design-context capture, anti-generic UI checks, critique/polish stage | **REFERENCE / TEST** | [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), [Impeccable](https://github.com/pbakaus/impeccable) |
| HeroUI v3 | UI foundation / AI-assisted frontend | accessible primitives, theming, agent-readable docs, MCP-backed implementation context | **POC → ADOPT CANDIDATE** | [HeroUI v3 announcement](https://heroui.com/en/docs/react/releases/v3-0-0), [v3.2.6](https://heroui.com/en/docs/react/releases/v3-2-6), [MCP](https://heroui.com/en/docs/react/getting-started/mcp-server), [LLMs.txt](https://heroui.com/en/docs/react/getting-started/llms-txt) |
| Datadog Agent Observability | LLM/agent observability | trace, prompt/version, latency, token/cost and evaluation patterns for Oracle Trace | **ADOPT PATTERN / TEST IMPLEMENTATION** | [Agent Observability](https://docs.datadoghq.com/llm_observability/), [Prompt Tracking](https://docs.datadoghq.com/llm_observability/instrument/prompt_tracking/) |

## What may be reused

- Versioned `SKILL.md`-style procedural knowledge and progressive loading.
- Human-readable memory as an inspectable source of truth, with retrieval as a secondary layer.
- Browser automation as a bounded fallback executor rather than the default ingestion path.
- Quant ideas as explicit hypotheses that must enter the Strategy Factory validation path before promotion.
- Durable product/design context plus deterministic critique rules for AI-generated interfaces.
- HeroUI primitives and machine-readable documentation as a candidate implementation substrate, while BLACK ORACLE retains its own design tokens and product language.
- Trace-centric observability that connects model, prompt, skills, tools, evidence, cost, latency and downstream outcome.

## What must not be copied blindly

- Installing all scientific skills into standing context.
- Treating a local Markdown memory project as production-grade financial memory infrastructure without authorization, lineage and retention controls.
- Replacing deterministic APIs/feeds with a browser agent when a stable structured source exists.
- Treating VWAP deviation as established alpha without out-of-sample, regime, slippage and multiple-testing controls.
- Letting third-party design skills override the BLACK ORACLE Product Constitution or create generic SaaS aesthetics.
- Migrating the entire frontend to HeroUI v3 before a narrow thin-slice PoC proves compatibility.
- Treating a vendor observability dashboard as BO's canonical evidence ledger; external telemetry must remain an adapter to BO-owned trace identity.

## Implementation boundary

This bundle does **not** authorize changes to live trading, paper trading, execution authority, credentials, model routing, production data sources or portfolio behavior. Any implementation proceeds through isolated PoCs and the Research → Review → Hypothesis → Experiment → Result → ADOPT / REJECT / REVISIT loop.
