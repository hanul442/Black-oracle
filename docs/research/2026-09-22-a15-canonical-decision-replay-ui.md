# BOT-A15 Product Truth Review — Canonical Decision Replay UI

Date: 2026-09-22
Status: IMPLEMENTED / CI PENDING
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

## Acceptance
1. trace-bearing event -> canonical replay API request
2. verified replay -> canonical label and timeline
3. no trace -> explicit Market event context
4. replay failure -> explicit context/failure state, not fabricated lineage
5. no trading/runtime/database mutation
6. Black Oracle CI + Trading CI pass

## Result
PENDING exact-head CI.

## Adopt / Reject
PENDING.

## Authority impact
None. Read-only product presentation only.
