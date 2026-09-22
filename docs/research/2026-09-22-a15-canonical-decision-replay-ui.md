# BOT-A15 Product Truth Review — Canonical Decision Replay UI

Date: 2026-09-22
Status: VERIFIED / ADOPT
Hypothesis: BOT-A15-H1
Experiment: BOT-A15-E1

## Problem
The Instrument Cockpit labelled a market-filtered canonical event list as Decision Replay even when the UI had not queried the canonical Decision Replay API and no replayable trace identity had been established.

## Hypothesis
The product can preserve useful market context while preventing false lineage claims by showing **Canonical Decision Replay** only after the existing replay API verifies a concrete trace; otherwise the same events must be labelled **Market event context**.

## Implementation
- derive a replay candidate only from canonical event `trace.traceId`, `links.traceId`, or `links.entryTraceId`
- prefer trace-bearing DECISION/RISK/ORDER/TRADE/OUTCOME events over generic context
- call `GET /api/decision-replay` with the exact trace and observed runtime identity
- require `canonical=true` and `found=true` before rendering the replay label
- display replay version, requested trace, and `completeThrough`
- retain market-filtered canonical events as context when a replay cannot be established
- never synthesize a trace ID or reinterpret context as verified lineage

## Verification result
Exact implementation/research head `599566b1defcdc0b632d55cc182e7f14f9e062a0`:
- Black Oracle CI run #35683709498 — SUCCESS
- Black Oracle Trading CI run #35683709801 — SUCCESS
- PR #231 mergeable after implementation CI — true

The integration compiles against the current mobile/Fold product shell and leaves the trading test suite green. No Risk, order, portfolio, persistence, or execution-authority code changed.

## Adopt / Reject
**ADOPT.** BOT-A15-E1 supports the hypothesis: canonical lineage is now distinguished mechanically from market context instead of being implied by the UI label.

## Authority impact
None. Read-only product presentation only.
