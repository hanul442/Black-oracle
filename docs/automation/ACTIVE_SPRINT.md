# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A15 ACTIVE — CANONICAL DECISION REPLAY UI**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- S14 merged as PR #229 / `66681b41856fe9fcff96df388167215f4e37bbdb`.
- Thinking Orbs normalized and merged as PR #230 / `78183f474db0938dce945d72f7a1fc7aca2bee01`.
- current product shell already exposes live-backed Command/Markets/Oracle/Trade/Lab/System views from `/api/trading-status`, `/api/strategy-factory-status`, and `/api/events`.

## BOT-A15 — canonical Decision Replay UI

### Gap found
The Instrument Cockpit labelled a market-filtered event list as **Decision Replay**, but it did not call the existing canonical `/api/decision-replay` endpoint. That risks presenting contextual events as if they were a verified trace.

### Objective
Bind the Instrument Cockpit to the canonical Decision Replay API only when a replayable `traceId` exists. When no replayable trace is present, label the list truthfully as market event context rather than synthesizing lineage.

### Acceptance criteria
- detect replayable `traceId` / linked trace identity only from canonical event trace/link fields
- call `GET /api/decision-replay` with the exact trace and runtime identity
- render canonical replay only when API reports `canonical=true` and `found=true`
- show replay version, requested trace, and `completeThrough`
- if trace is absent or replay is unavailable, retain the market event list but explicitly label it **Market event context**
- no inferred trace IDs, no fabricated lineage, no mutation of trading/runtime state
- preserve existing Instrument Cockpit, trade map, Evidence/Council, chart, mobile/Fold behavior
- Black Oracle CI + Trading CI must both pass before merge

## Safety boundary
Read-only UI integration only. No order path, Risk, strategy, portfolio, broker, database, PAPER history, or execution authority changes.

## Rollback
Repository-only revert/close of BOT-A15 PR. Existing API/runtime contracts remain unchanged.

## Current deployment state
Legacy Railway/PAPER services unchanged. No deployment/database mutation is required.

## Cycle exit record
- Phase: **PRODUCT TRUTH AUDIT → IMPLEMENT**
- Blocker: CI pending
- Alpha status: execution-safety baseline complete; product truth integration active
- Single next priority: **verify canonical replay UI exact-head CI and merge only if green**
