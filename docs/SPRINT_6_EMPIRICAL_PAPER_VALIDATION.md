# BLACK ORACLE — Sprint 6 Empirical PAPER Validation

Status: DRAFT / PAPER ONLY
Base: Sprint 5R verified operator/research stack

## Objective

Sprint 6 stops treating feature count as progress. Its purpose is to prove that the existing PAPER system is continuously producing auditable empirical evidence at the intended cadence and that research qualification metrics are driven by persisted future outcomes rather than reconstructed or synthetic state.

## Hard exit statement

> BLACK ORACLE PAPER runtime is provably accumulating validation evidence at the expected cadence, daily empirical state is reconstructable from persisted checkpoint truth, and Strategy Factory / Council / Grade / Experiment sample readiness reflects actual resolved outcomes without granting execution or promotion authority.

## Empirical accumulation health

Operational health and sample readiness are separate.

Operational gates:
- runtime recency
- expected PAPER cycle cadence coverage
- recent cycle error rate

Research sample gates:
- Strategy Factory aligned observations: target >= 60 for PBO eligibility
- resolved Council v1/v2 comparisons: initial review target >= 30
- closed PAPER trades: empirical qualification target >= 60
- Grade Surveillance snapshots: initial history target >= 24
- at least one Experiment Ledger STARTED or COMPLETED event

Dispositions:
- `INSUFFICIENT_DATA`: no persisted PAPER cycle truth exists yet
- `STALLED`: latest PAPER cycle is stale relative to configured cadence
- `DEGRADED`: runtime is active but operational accumulation gates fail
- `COLLECTING`: runtime is operational but empirical sample gates remain incomplete
- `HEALTHY`: operational and current minimum sample gates are satisfied

These dispositions are observation/governance metadata only. They have `executionAuthority=false` and `promotionAuthority=false`.

## Daily empirical report

The read-only empirical validation API derives a KST-local daily report from the persisted runtime checkpoint:
- cycle count / scans / ENTER / EXIT / HOLD / NO_TRADE / market errors
- Evidence-linked decision coverage
- closed-trade count / win rate / net realized PAPER P&L
- blind validation samples created
- Council observations and resolved comparisons
- Strategy Factory observations and resolved outcomes
- Experiment started/completed events
- Grade opening/closing state and active gates

No daily metric is synthesized when source data is missing.

## Operator surface

LAB exposes a compact empirical strip with:
- empirical disposition
- latest cycle age
- observed / expected recent cycles
- cadence coverage
- cycle error rate
- PBO aligned progress and ETA derived only from observed resolution rate
- Council resolved progress
- closed-trade progress
- Grade history depth
- Experiment tried events
- daily Evidence link rate
- daily realized PAPER P&L

## Truth and authority boundary

Sprint 6 does not:
- deploy or change the production scheduler
- change production risk limits
- add exchange credentials or live order endpoints
- let an LLM place orders
- automatically promote Council v2
- automatically promote Strategy Factory candidates
- automatically transition PAPER to LIVE

All release or production rollout changes remain explicit human approvals after exact-revision CI, browser QA, deployed Preview verification, readiness checks and scheduler review.
