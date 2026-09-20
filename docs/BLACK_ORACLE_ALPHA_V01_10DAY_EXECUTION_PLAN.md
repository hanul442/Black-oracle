# BLACK ORACLE Alpha v0.1 — 10-Day Execution Plan

Status: **ACTIVE AFTER ARCHITECTURE FREEZE**
Freeze date: **2026-09-20**
Internal Alpha target: **2026-09-30**
Stabilization target: **2026-10-03 ~ 2026-10-05**

Depends on:
- `BLACK_ORACLE_ARCHITECTURE_VNEXT_FREEZE_2026-09-20.md`
- current `main` runtime truth
- protected historical PAPER / Evidence / Ledger records

## 1. Delivery model

Three lanes run in parallel.

### Lane A — Quant / Trading
Strategy Registry -> Validation -> Router -> Risk -> PAPER -> Outcome

### Lane B — Research / AI
NARS/Source -> Evidence -> Researcher -> Analyst -> Challenger -> Synthesizer -> Report

### Lane C — Product / Reliability
Shared contracts -> Ledger/Replay -> UI -> observability -> E2E -> release

No lane may silently change execution authority.

## 2. Daily plan

### D0 — 2026-09-20 — FREEZE
- freeze vNext architecture
- freeze Alpha scope
- classify conflicting open PRs
- block repository split for Alpha
- block LIVE activation as release criterion
- record 9/30 exit criteria

Exit:
- one documented architecture source of truth
- no unresolved top-level direction decision required for D1

### D1 — 2026-09-21 — FOUNDATION I
Lane A:
- Strategy/Experiment contract audit
- identify reusable validation code

Lane B:
- Evidence/Report contract audit
- NARS -> Research boundary

Lane C:
- canonical IDs / trace contract
- target module map inside current repo

Exit:
- contracts compile or are fully specified
- no duplicate canonical identity introduced

### D2 — 2026-09-22 — FOUNDATION II
Lane A:
- Strategy Registry projection
- Experiment Registry / research contract

Lane B:
- versioned Report artifact identity
- source/evidence provenance projection

Lane C:
- Ledger trace coverage map
- UI read-model contracts

Exit:
- strategy, experiment, evidence, report, trace identities are stable enough for integration

### D3 — 2026-09-23 — QUANT CORE
- reproducible Backtest path
- dataset/config fingerprint
- leakage/lookahead validation hooks
- chronological OOS / walk-forward path
- current strategy validation tests

Exit:
- one existing strategy reproduces from frozen inputs

### D4 — 2026-09-24 — ROBUSTNESS + RESEARCH CORE
Lane A:
- Monte Carlo/bootstrap
- fee/slippage stress
- lifecycle disposition

Lane B:
- Researcher
- Analyst
- Challenger
- Synthesizer
- structured report output

Exit:
- one strategy has a complete validation packet
- one real Evidence packet produces a traceable report

### D5 — 2026-09-25 — DECISION
Lane A:
- Router
- NO_TRADE as first-class result
- Champion/Challenger projection

Lane B:
- agent eval fixtures
- provenance / contradiction checks

Lane C:
- Strategy Lab / Report detail integration

Exit:
- candidate vs NO_TRADE behavior is inspectable
- Report output exposes sources and limitations

### D6 — 2026-09-26 — CONTROL + PAPER
- deterministic Risk contract
- PAPER path integration
- Council remains SHADOW
- pre/post decision snapshots
- no authority leakage from AI/Report

Exit:
- one complete PAPER decision passes end to end
- risk rejection remains replayable

### D7 — 2026-09-27 — OUTCOME + OBSERVABILITY
- outcome attribution
- Decision Replay completion
- AI cost trace
- Sentry error monitoring
- PostHog product analytics/session replay
- Langfuse or equivalent LLM trace layer

Exit:
- critical failures become observable
- one trade can be replayed from source/evidence through outcome

### D8 — 2026-09-28 — PRODUCT INTEGRATION
BOT:
- Overview
- Strategy Lab
- Trading
- Risk
- Ledger

BOR:
- Today
- Research
- Evidence
- Reports
- Library

- mobile/Fold full-page detail
- no modal-only critical workflow
- empty/error/degraded states

Exit:
- all core flows usable from product UI

### D9 — 2026-09-29 — RC1
- Playwright critical-path E2E
- trading regression
- research/eval regression
- Ledger completeness checks
- mobile scroll/navigation
- stale/missing-data fail-closed tests
- release blocker triage

Allowed work:
- P0 critical
- P1 major
- data correctness
- security
- unusable UI

No new features.

Exit:
- RC1 tagged or equivalent release candidate SHA recorded

### D10 — 2026-09-30 — INTERNAL ALPHA v0.1
- final CI
- deployment verification
- runtime/readiness verification
- Alpha release notes
- known-gap register
- rollback reference
- daily-use start

LIVE capital remains BLOCKED.

## 3. Stabilization window — 2026-10-01 ~ 2026-10-05

Use real daily operation to collect:

- UI friction
- missing data states
- false/weak reports
- Strategy validation mismatches
- Router/NO_TRADE quality
- Council counterfactual value
- Ledger gaps
- cost outliers
- runtime incidents

Only fix observed Alpha problems.

Recommended stabilized Alpha release: **2026-10-03 ~ 2026-10-05**.

## 4. Live Canary is qualification-based, not date-based

Future sequence:

```text
PAPER
 -> LIVE_SHADOW
 -> Broker order test/dry-run
 -> minimum live canary
 -> staged exposure
 -> LIVE
```

Activation requires separate evidence for:
- broker isolation
- reconciliation
- duplicate-order protection
- kill switch
- secret isolation
- deterministic Risk
- runtime stability
- rollback

A date alone never grants live-capital authority.

## 5. PR operating rules

Prefer vertical PRs such as:

1. Registry + tests
2. Validation pipeline + tests
3. Evidence/Report pipeline + tests
4. Router/Risk/PAPER integration
5. Replay/UI integration
6. E2E/hardening

Avoid PR churn that only records intermediate checkpoints unless it proves a safety or deployment boundary.

Every material implementation PR should include:
- objective
- authority impact
- changed contracts
- tests
- acceptance evidence
- rollback
- known gaps

## 6. Tooling target for Alpha

Required / recommended:
- GitHub — source, PR, CI
- Railway — web/runtime
- Supabase — canonical persistence
- OpenAI API — bounded research/analysis/evals
- Playwright — E2E
- Vitest/Pytest — unit/integration
- Sentry — runtime errors/tracing
- PostHog — product/session observability
- Langfuse or equivalent — LLM traces/evals
- Figma — design reference, not a blocker

Optional coding accelerator:
- Cursor Pro or one equivalent IDE agent; do not pay for overlapping assistants unless throughput is demonstrably improved.

## 7. Cost envelope

Alpha target operating envelope:
- lean: roughly KRW 30k–50k/month
- recommended: roughly KRW 120k–150k/month
- spending above this is not expected to materially shorten the Alpha critical path at current scale

Major speed constraint is scope/rework, not compute capacity.

## 8. Release principle

The Alpha objective is not “most features.”

It is:

> **BOT and BOR each complete one real end-to-end loop, while the shared Ledger can prove what happened and deterministic Risk prevents unsafe authority escalation.**
