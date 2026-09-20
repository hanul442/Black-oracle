# BLACK ORACLE Architecture vNext — Alpha Freeze

Status: **FROZEN FOR ALPHA v0.1**
Date: **2026-09-20**
Target internal Alpha: **2026-09-30**
Recommended stabilized Alpha: **2026-10-03 ~ 2026-10-05**
Authority impact: **NONE** — documentation/architecture freeze only

This document is the working architecture baseline for the BLACK ORACLE Alpha v0.1 build. It supersedes conflicting future-planning assumptions in earlier redesign documents and open planning PRs. Runtime truth, historical ledger data, PAPER outcomes, research evidence, and safety controls remain authoritative and are not rewritten by this document.

## 1. Product definition

BLACK ORACLE is an investment R&D and execution system that:

> collects market evidence, formulates hypotheses, validates strategies and AI decisions, executes only under deterministic risk controls, records the complete decision lineage, and learns from realized outcomes.

The system has two product experiences over one shared technical spine:

- **BOR / Research** — Evidence & Research product.
- **BOT / Trading** — Quant & Trading product.

They are independent user workflows, but Alpha v0.1 does **not** physically split them into separate repositories or duplicate shared infrastructure.

Canonical principle:

> **Two Products / Two Engines / One Shared Spine / Isolated Execution**

## 2. Alpha repository and runtime decision

### 2.1 Repository

Alpha remains in the current repository:

`hanul442/Black-oracle`

Target modular structure:

```text
black-oracle/
  apps/
    trading/
    research/
  services/
    quant/
    research/
    executor/
  packages/
    canonical/
    contracts/
    ledger/
    market-data/
    ui/
  docs/
    research/
```

The physical repository split proposed in earlier planning is **POSTPONED** until a real operational reason exists.

### 2.2 Shared spine

The following are shared and canonical:

- stable instrument/entity IDs
- market-data contracts
- Evidence provenance
- Canonical Event Ledger
- trace_id / lineage contracts
- experiment identity
- AI usage/cost telemetry
- observability conventions
- design tokens / shared UI components

Shared lineage does not imply shared execution authority.

### 2.3 Isolated execution

Execution remains a separate authority boundary even while source code is in one repository.

Browser / Research Agent / Council / Report may not call broker APIs directly.

Target boundary:

```text
BOT decision intent
  -> deterministic risk
  -> execution adapter
  -> broker
  -> fill/reconciliation
  -> canonical ledger
```

LIVE remains BLOCKED for Alpha v0.1.

## 3. BOT canonical loop

Alpha BOT is:

```text
Market
  -> Strategy Registry
  -> Hypothesis / Experiment
  -> Backtest
  -> Walk-Forward / OOS
  -> Robustness / Monte Carlo / Cost Stress
  -> Strategy Lifecycle
  -> Router
  -> NO_TRADE or Candidate
  -> Deterministic Risk
  -> PAPER / LIVE_SHADOW
  -> Outcome
  -> Attribution / Replay
```

### 3.1 Strategy lifecycle

```text
IDEA
  -> RESEARCH
  -> VALIDATED
  -> PAPER
  -> CHALLENGER
  -> CHAMPION
  -> PROBATION
  -> RETIRED
```

No backtest score, LLM recommendation, Council majority, or composite grade can automatically promote a strategy into real-capital authority.

### 3.2 Validation rule

Promotion evidence must include, where applicable:

- point-in-time dataset identity
- leakage/lookahead checks
- chronological OOS / walk-forward
- Monte Carlo / bootstrap robustness
- fee/slippage stress
- parameter sensitivity
- regime stability
- minimum sample quality
- execution parity
- lineage completeness

`NO_TRADE` remains a first-class decision.

## 4. BOR canonical loop

Alpha BOR is:

```text
Source / NARS
  -> Evidence
  -> Researcher
  -> Analyst
  -> Challenger
  -> Synthesizer
  -> Versioned Report
  -> Archive / Evaluation
```

BOR is an **Evidence Intelligence System**, not an execution gate.

Reports may be referenced by BOT, but any execution-relevant claim must be re-evaluated under current execution policy, freshness, provenance, contradiction, and risk rules.

## 5. Agent architecture

Alpha does **not** implement a large always-on AI company.

Default Alpha roles:

1. **Researcher** — collection / normalization / source-backed extraction
2. **Analyst** — thesis / scenario / quantitative interpretation
3. **Challenger** — counterevidence / missing-risk / invalidation search
4. **Synthesizer** — final structured report

Domain specialists are invoked only when required by the task and evidence.

Agent expansion is justified only by measured failure modes or eval gains.

## 6. Council authority

Council is an experiment, not sovereign authority.

For Alpha v0.1:

```text
Strategy / Router
  +--> Council SHADOW -> recommendation -> Ledger
  |
  +--> Deterministic Risk -> PAPER execution
```

Council recommendations must be recorded prospectively so the system can compare:

- baseline decision
- Council recommendation
- Red Team challenge
- actual outcome

Authority progression after Alpha, if evidence supports it:

```text
SHADOW
  -> ADVISORY
  -> VETO_ONLY
  -> LIMITED_AUTHORITY
```

## 7. Risk constitution

Deterministic Risk is sovereign.

The following must be code-enforced and not delegated to LLMs:

- maximum position
- portfolio exposure
- account drawdown
- rolling loss limits
- stale/missing market data
- liquidity/slippage boundaries
- duplicate-order protection
- cooldowns
- reconciliation mismatch handling
- kill switch
- authority mode

LLMs may explain or recommend. They do not bypass controls.

## 8. Canonical Ledger = system of record

The key Alpha differentiator is complete replayable lineage.

Target trace:

```text
SOURCE
 -> EVIDENCE
 -> CLAIM / HYPOTHESIS
 -> STRATEGY / EXPERIMENT
 -> VALIDATION
 -> ROUTER
 -> COUNCIL_SHADOW
 -> RISK
 -> ORDER
 -> FILL
 -> POSITION
 -> EXIT
 -> OUTCOME
 -> ATTRIBUTION
```

A meaningful decision must be inspectable through one `trace_id`.

Missing evidence is represented as DATA_GAP / NOT_AVAILABLE / NOT_APPLICABLE; it is never fabricated.

## 9. Alpha v0.1 product surfaces

BOT:
- Overview
- Strategy Lab
- Trading
- Risk
- Ledger / Replay
- Settings

BOR:
- Today
- Research
- Evidence
- Reports
- Library
- Settings

Markets are embedded in Overview / Research rather than duplicated as a large independent navigation tree for Alpha.

Council/Oracle is shown inside decision/report detail, not as a mandatory top-level menu.

Core objects open as full-page detail views on mobile/Fold.

## 10. Existing asset disposition

### KEEP / STRENGTHEN

- Canonical Event Ledger
- Decision Replay
- NARS / Evidence provenance
- market-data truth / freshness
- Strategy Factory primitives
- validation / Monte Carlo / OOS foundations
- PAPER runtime
- deterministic Risk
- forecast calibration
- AI usage/cost ledger
- chart foundations
- Supabase historical records
- runtime incident and qualification evidence

### MODIFY

- Strategy Factory -> bounded, hypothesis/experiment governed
- Council -> SHADOW-first measured contribution
- Report -> Evidence Intelligence product
- UI -> reduced Alpha IA, full-page details
- Router -> explainable, NO_TRADE first-class
- Agent organization -> 4-role default + conditional specialists
- repository organization -> modular boundaries within current repo

### POSTPONE

- physical BOT/BOR repository split
- BOT/BOR duplicate databases
- full multi-agent company / automatic team lifecycle
- live-capital activation
- unlimited Strategy generation
- Community implementation
- full Credit Economy / billing
- Enterprise plans
- derivatives
- stock live execution
- 2D autonomous office
- app-store packaging
- major animation/gameification

### DO NOT DELETE DURING ALPHA

No historical runtime, PAPER, Evidence, ledger, qualification, migration, or deployed-source artifact may be physically deleted solely because it is not part of the Alpha product surface.

## 11. Open planning PR disposition

- **#197** — superseded as canonical direction because it removes AutoTrade from the active architecture. Preserve useful audit findings; do not use its product direction as Alpha authority.
- **#198** — research-only evidence; retain as R&D input. No runtime authority.
- **#200** — selectively reusable Report/Agent/cost foundations. Credit/billing and Report-first product primacy are not Alpha requirements. Do not merge wholesale merely to obtain those modules.
- **#201** — repository-extraction direction is superseded by the Alpha modular-monorepo decision. Preserve its extraction inventory as future migration evidence.

## 12. Change-control rule through 2026-09-30

Until Internal Alpha:

1. no new top-level product direction;
2. no new large feature unless it closes an Alpha acceptance gap;
3. new ideas go to POST_ALPHA_BACKLOG;
4. runtime authority changes require a dedicated PR and explicit gate;
5. implementation PRs should be vertical, testable slices rather than checkpoint churn;
6. target cadence is roughly 3–6 meaningful PRs/day when needed, not maximum PR count.

## 13. Alpha v0.1 exit criteria

Alpha is complete when:

### BOT
- one strategy can travel from registered hypothesis through reproducible validation to PAPER decision/outcome;
- Router can explicitly return NO_TRADE;
- deterministic Risk is authoritative;
- one trade and one NO_TRADE decision can be fully replayed;
- Strategy state and validation evidence are visible.

### BOR
- a real source/NARS item can travel through Evidence -> analysis -> challenge -> synthesis -> versioned report;
- source provenance and timestamp are inspectable;
- missing/counter evidence is explicit;
- at least one report can be evaluated/replayed from its inputs.

### Shared
- canonical lineage is intact;
- no fabricated data is required for core views;
- critical mobile/Fold navigation and scrolling pass;
- regression suite passes;
- Sentry/PostHog/LLM tracing or equivalent observability is wired for Alpha;
- LIVE capital remains blocked.

## 14. Frozen decision

For Alpha v0.1, optimize for:

> **working end-to-end loops, measurement, replayability, and safety — not feature count.**

Any architecture or product proposal that increases scope without improving those four properties is deferred until after 2026-09-30.
