# BLACK ORACLE — Sprint 6 Empirical PAPER Validation

Status: DRAFT / PAPER ONLY
Base: Sprint 5R verified operator/research stack

## Objective

Sprint 6 stops treating feature count as progress. Its purpose is to prove that the existing PAPER system is continuously producing auditable empirical evidence at the intended cadence and that research qualification metrics are driven by persisted future outcomes rather than reconstructed, synthetic, or legacy state.

## Hard exit statement

> BLACK ORACLE PAPER runtime is provably accumulating validation evidence at the expected cadence, daily empirical state is reconstructable from persisted checkpoint truth, and Strategy Factory / Council / Grade / Experiment sample readiness reflects actual resolved outcomes from the explicitly armed qualification window without granting execution or promotion authority.

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

## PAPER Qualification Window

Legacy PAPER history cannot qualify the new Evidence-governed release.

A qualification window is intentionally configured with all three server-side values:
- `PAPER_QUALIFICATION_WINDOW_ID`
- `PAPER_QUALIFICATION_ARMED_AT`
- `PAPER_QUALIFICATION_SOURCE_REVISION`

Leaving all three unset means no qualification credit can start. Partial configuration fails closed for qualification and does not gain trading authority.

The persisted window starts in `ARMED` state. It advances to `COLLECTING` only after a PAPER cycle that:
- starts and finishes after the configured arming time
- scans at least one market
- records no market errors in that cycle
- actually references at least one Evidence id in its decision traces
- uses Evidence observed after the arming time
- uses non-`SYSTEM`, source-backed Evidence with an HTTP(S) source URL
- remains pinned to the configured exact source revision

The first qualifying cycle's `startedAt` becomes the immutable qualification `startedAt` so observations produced by that cycle can receive credit.

A persisted window whose id, arming time, or source revision no longer matches configuration is marked `INVALIDATED`. BLACK ORACLE never silently shifts the qualification window to make old samples qualify.

## Qualification-scoped credit

The empirical API exposes raw operational history separately from qualification-scoped evidence.

Only records generated inside the started qualification window receive qualification credit:
- PAPER cycles: `cycle.startedAt >= qualification.startedAt`
- blind validation: `decisionTimestamp >= qualification.startedAt`
- Council comparison: `generatedAt >= qualification.startedAt`
- Strategy Factory: `generatedAt >= qualification.startedAt`; aligned count is recomputed only from resolved in-window observations
- Experiment/Grade history: event timestamp >= qualification start
- closed PAPER trade: **the position must have opened after qualification start**

A legacy position opened before the qualification window receives zero qualification credit even if it closes after the window starts.

Before the window reaches `COLLECTING`, qualified PBO/Council/closed-trade/Grade/Experiment counts remain zero. Raw legacy totals may remain visible as operational context but cannot satisfy Sprint 6 empirical exit gates.

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

The same report is also calculated on qualification-scoped input. No daily metric is synthesized when source data is missing.

## Operator surface

LAB exposes a compact empirical strip with raw operational cadence and clearly prefixed qualified (`Q`) research progress:
- empirical disposition
- Qualification Window id/status/revision
- latest cycle age
- observed / expected recent cycles
- cadence coverage
- cycle error rate
- Q PBO aligned progress and ETA derived only from observed in-window resolution rate
- Q Council resolved progress
- Q closed-trade progress
- Q Grade history depth
- Q Experiment tried events
- Q daily Evidence link rate
- Q daily realized PAPER P&L

## Persistence and compatibility

Qualification Window is an optional schema-v1 runtime-checkpoint extension. Existing checkpoints that do not contain the field remain valid. No new Supabase table or migration is required.

## Truth and authority boundary

Sprint 6 does not:
- deploy or change the production scheduler
- change production risk limits
- add exchange credentials or live order endpoints
- let an LLM place orders
- automatically promote Council v2
- automatically promote Strategy Factory candidates
- automatically transition PAPER to LIVE
- automatically arm or start a qualification window

All release or production rollout changes remain explicit human approvals after exact-revision CI, browser QA, deployed Preview verification, readiness checks and scheduler review.
