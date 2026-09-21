# ACTIVE SPRINT — BOT Alpha Separation & Scanner Foundation

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **IN PROGRESS**

## Current work package — BOT-S1 Scanner input boundary

### Objective
Make persisted Upbit KRW universe observations readable through one fail-closed repository/read-model boundary in the independent BOT repository, without binding a concrete database or changing PAPER/LIVE behavior.

### Acceptance criteria
- Define `UpbitUniverseSnapshotRepository` with `save` and `latest` operations.
- Re-evaluate every persisted snapshot against the canonical freshness policy at read time.
- `NO_SNAPSHOT`, stale, invalid, and future observations are scanner-ineligible while last-good data remains auditable.
- Reuse the existing A03–A06 canonical universe/snapshot contracts; do not fork freshness semantics.
- Export the boundary through the trading barrel.
- Add repository-native tests for no snapshot, fresh snapshot, stale last-good and future timestamp behavior.
- Typecheck, trading tests, and production build must be green before merge.

### Safety boundary
- Public market metadata only.
- No broker/private Upbit credentials or private endpoints.
- No order submission, portfolio mutation, LIVE authority, Risk bypass, or PAPER behavior change.
- Scanner eligibility never grants execution authority.

### Rollback path
This work is additive. Revert the BOT-S1 PR to remove the repository/read-model port; A02–A06 and existing PAPER behavior remain unchanged.

### Exact next gate
`PR #211 CI green (typecheck + trading tests + build) → merge BOT-S1 → then BOT-S2 independent runtime/database ownership contract.`

## Research review for BOT-S1

- **DI-003 — Point-in-time feature availability:** scanner inputs must preserve what was knowable at decision time; read-time freshness is mandatory.
- **DI-004 — Snapshot-addressable replay:** persisted snapshot identity remains available for later Decision Replay/audit even when stale.
- **DI-001 — Canonical experiment record:** do not create a parallel scanner ledger; preserve canonical lineage for later validation manifests.
- **EV-001 / Q-002:** no execution/backtest assumptions are changed by this input-boundary work.

Research disposition: **REFERENCE / TEST constraints only. No production/PAPER policy adoption in this cycle.**

## Today — ordered plan

- BOT-S0 Repository boundary bootstrap — **DONE**
- BOT-S1 Scanner input boundary — **IMPLEMENTED / CI GATE**
- BOT-S2 Independent runtime/database boundary — **NEXT**
- BOT-S3 Validation core — **QUEUED**

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
- Legacy A07 PR #209 remains unmerged/stale; BOT-S1 re-implements only its small scanner read boundary against current separated main.

## Cycle exit record

- Phase: **IMPLEMENT + DOCUMENT COMPLETE → CI VERIFY GATE**
- Completed this cycle: repository port, fail-closed read model, trading barrel export, four boundary tests
- Research reviewed: DI-001, DI-003, DI-004, EV-001, Q-002
- Validation: **Black Oracle CI #988 and Black Oracle Trading CI #1167 started; currently in progress**
- PR: **#211 OPEN**, head `caff03f65043fa5853dc2eb7b7d9f23772070dbb` before this documentation update
- Deployment: none
- Slack report: https://hanullab.slack.com/archives/C0C2Y1RJJP3/p1789948963419329
- Blockers: CI completion is the merge gate; independent BOT runtime/database remains unprovisioned but does not block S1
- Next checkpoint: if #211 is green, merge and begin **BOT-S2 — independent runtime/database ownership + rollback contract**
