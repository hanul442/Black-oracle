# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A15 VERIFIED / ADOPT — FINAL CI + MERGE GATE**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- S14 merged as PR #229 / `66681b41856fe9fcff96df388167215f4e37bbdb`.
- Thinking Orbs normalized and merged as PR #230 / `78183f474db0938dce945d72f7a1fc7aca2bee01`.

## BOT-A15 — canonical Decision Replay UI

### Product truth gap closed
The Instrument Cockpit previously labelled a market-filtered event list as **Decision Replay** without querying the canonical replay endpoint. BOT-A15 now distinguishes verified trace replay from ordinary market event context.

### Delivered
- new `CanonicalDecisionReplayPanel`
- trace candidates come only from canonical `trace.traceId`, `links.traceId`, or `links.entryTraceId`
- `GET /api/decision-replay` is called with the exact trace and observed runtime identity
- **Canonical Decision Replay** appears only when `canonical=true` and `found=true`
- replay version, requested trace, and `completeThrough` are visible
- absent/unavailable trace falls back to explicitly labelled **Market event context**
- no inferred trace IDs or fabricated lineage

### Verification
- exact implementation head: `599566b1defcdc0b632d55cc182e7f14f9e062a0`
- Black Oracle CI #35683709498 — **SUCCESS**
- Black Oracle Trading CI #35683709801 — **SUCCESS**
- PR #231 mergeable after implementation CI — **true**
- BOT-A15-E1 — **ADOPT**

## Safety boundary
Read-only UI integration only. No order path, Risk, strategy, portfolio, broker, database, PAPER history, deployment, or execution authority changed.

## Rollback
Repository-only revert/close of PR #231. Existing API/runtime contracts remain unchanged.

## Exact next gate
Require fresh docs-inclusive Black Oracle CI + Trading CI on the final PR #231 head. If both remain green and PR is mergeable, squash merge.

## Cycle exit record
- Phase: **VERIFY / DOCUMENT COMPLETE → FINAL CI / MERGE GATE**
- PR: #231 (`bot-a15-canonical-replay-ui` → `main`)
- Research result: **BOT-A15-E1 ADOPT**
- Single next priority: **final CI, then merge only if green**
