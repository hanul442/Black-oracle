# ACTIVE SPRINT — BOT Alpha Validation Core

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **IN PROGRESS**

## Current work package — BOT-S3 Canonical validation experiment manifest

### Objective
Create one fail-closed, versioned validation manifest that can identify a strategy experiment across Backtest, OOS, Walk-Forward, Monte Carlo and execution-cost stress without granting promotion or execution authority.

### Acceptance criteria
- Define a single `bot.validation-experiment.v1` manifest rather than another disconnected backtest ledger.
- Capture strategy revision, code revision, data/snapshot identity, point-in-time availability policy, split manifest, execution-cost assumptions and requested validation stages.
- Require explicit Backtest, OOS, Walk-Forward, Monte Carlo and execution-cost-stress stage declarations.
- Fail closed on missing identities, invalid/overlapping train/OOS windows, non-point-in-time inputs, invalid cost assumptions, duplicate stages or authority flags.
- Manifest is immutable data and carries `promotionAuthority=false`, `executionAuthority=false`, `capitalAuthority=false`.
- Add repository-native tests and export through the trading barrel.
- Typecheck, trading tests and production build must be green before merge.

### Safety boundary
- Validation metadata/contracts only; no strategy logic, Router, Council, deterministic Risk, position sizing or PAPER behavior changes.
- No infrastructure provisioning, broker credentials, private Upbit calls, orders, portfolio mutation or LIVE authority.
- A passing experiment cannot promote a strategy or allocate capital by itself.

### Rollback path
Revert the BOT-S3 PR. S0–S2 and existing PAPER/runtime/database state remain unchanged because S3 is additive and persistence-free.

### Exact next gate
`canonical manifest + fail-closed tests → CI green → merge BOT-S3 → implement stage-result/evaluation records against this manifest before Strategy Factory expansion.`

## Research review for BOT-S3

- **DI-001 — Canonical experiment record:** primary constraint. One record must bind code/config, data identity, split manifests, execution assumptions, outputs and later promotion decisions.
- **DI-003 — Point-in-time availability:** validation inputs must explicitly assert point-in-time-safe feature/data availability; snapshot identity alone is insufficient.
- **DI-004 — Snapshot-addressable replay:** manifest must preserve stable data/snapshot identities for later Decision Replay and reproduction.
- **EV-001 — Engine reproducibility:** engine identity/version belongs in the experiment record; engine disagreement is a separate validation risk.
- **Q-002 — Execution-cost risk:** fee/spread/slippage assumptions are explicit manifest inputs and must not be hidden inside a backtest engine.
- **AIML-005 / AIML-006:** Council/agent expansion remains downstream of a frozen validation baseline and is not part of this work package.

Research disposition: **ADOPT-SCHEMA-CANDIDATE for DI-001; TEST/REFERENCE constraints for the rest. No trading policy adoption.**

## Today — ordered plan

- BOT-S0 Repository boundary bootstrap — **DONE**
- BOT-S1 Scanner input boundary — **DONE / MERGED #211**
- BOT-S2 Independent runtime/database boundary — **DONE / MERGED #212**
- BOT-S3 Canonical validation experiment manifest — **IN PROGRESS**
- BOT-S4 Validation stage result/evaluation records — **QUEUED**

## Safety invariants

- Unrestricted LIVE remains blocked.
- `LIVE_CANARY` is readiness-only until explicit qualification.
- Deterministic Risk cannot be bypassed.
- Broker secrets cannot reach frontend/agent contexts.
- Stale/restricted market data fails closed.
- Existing working PAPER behavior and historical lineage are preserved.

## Current known state

- BOT-S1 merged as `a955309b0f54287f1893a851975e9f53cdc10450`.
- BOT-S2 PR #212 passed Black Oracle CI #992 and Trading CI #1171 and merged as `915cb5bd686a7f44cdd938a52d2e30f8e5bcf2b3`.
- Independent BOT infrastructure is still unprovisioned; provider/credential mutation is not required for S3 and remains a separate gate.
- Legacy PAPER remains protected migration evidence.

## Cycle exit record

- Phase: **PLAN + RESEARCH REVIEW COMPLETE → IMPLEMENT**
- Completed this cycle so far: verified S2 CI; merged #212; recorded S3 objective, acceptance criteria, safety boundary, rollback and research constraints before implementation
- Research reviewed: DI-001, DI-003, DI-004, EV-001, Q-002, AIML-005, AIML-006
- Validation: S2 Black Oracle CI #992 PASS; Trading CI #1171 PASS
- PR: #212 MERGED; S3 PR pending
- Deployment: none
- Blockers: independent infrastructure requires a separate provider/credential mutation gate but does not block validation-core contracts
- Next checkpoint: implement `bot.validation-experiment.v1` + fail-closed tests
