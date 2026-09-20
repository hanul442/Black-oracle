# ACTIVE SPRINT — BOT Alpha Separation & Scanner Foundation

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **IN PROGRESS**

## Objective

Convert the newly separated repository into the canonical BLACK ORACLE BOT home, remove product-boundary ambiguity, and resume the Alpha build from the migrated A02–A06 foundation without coupling back to the legacy combined runtime.

## Today — ordered plan

### BOT-S0 — Repository boundary bootstrap
Acceptance criteria:
- BOT-only README.
- Persistent operating-cycle document.
- Current Alpha sprint stored in-repo.
- Research inputs for this sprint recorded.
- No BOR product UI/runtime ownership claimed by BOT.

### BOT-S1 — Scanner input boundary
Acceptance criteria:
- Re-implement the A07 repository/read-model boundary cleanly in this repository.
- Collector → canonical KRW universe → freshness → snapshot → repository/read model becomes one deterministic scanner input path.
- No stale snapshot may become scanner-eligible.
- Typecheck, trading tests and build green.

### BOT-S2 — Independent runtime/database boundary
Acceptance criteria:
- Define BOT runtime/deployment contract and DB ownership.
- Preserve legacy PAPER sample as read-only migration evidence.
- No destructive migration and no automatic LIVE authority.
- Railway/Supabase binding only after exact ownership and rollback are documented.

### BOT-S3 — Validation core
Acceptance criteria:
- Strategy registry/factory inputs are versioned.
- Backtest / OOS / Walk-Forward / Monte Carlo evidence is distinguishable.
- Begin canonical experiment manifest work before expanding strategy count.

## Research inputs reviewed

- **DI-001 / DI-003** — canonical experiment record + point-in-time feature availability are the highest-priority validation bottleneck.
- **DI-004** — immutable snapshot replay supports later Decision Replay and scanner audit.
- **Q-002 / EV-001** — execution-cost risk and engine reproducibility must be tested separately.
- **AIML-005 / AIML-006** — Council changes require a frozen task baseline and budget-matched ablation; more agents are not assumed better.
- **D-005** — product surfaces should follow Decision → Why → Audit progressive disclosure.

## Safety invariants

- Unrestricted LIVE remains blocked.
- `LIVE_CANARY` is readiness-only until explicit qualification.
- Deterministic Risk cannot be bypassed.
- Broker secrets cannot reach frontend/agent contexts.
- Stale/restricted market data fails closed.
- Existing working PAPER behavior and historical lineage are preserved.

## Current known state

- BOT-A02 Authority model: merged.
- BOT-A03 Upbit KRW universe: merged.
- BOT-A04 freshness gate: merged.
- BOT-A05 public collector: merged.
- BOT-A06 universe snapshot boundary: merged.
- Legacy A07 PR was not merged because of TypeScript CI failure; it should be re-implemented and verified cleanly in this independent repository rather than blindly copied.

## Cycle exit record

This section must be updated at the end of every cycle.

- Phase: PLAN / RESEARCH REVIEW
- Completed this cycle: repository bootstrap documentation
- Validation: documentation verification pending
- PR: pending
- Deployment: none
- Blockers: independent BOT runtime/database still not provisioned
- Next checkpoint: BOT-S1 — scanner repository/read-model boundary
