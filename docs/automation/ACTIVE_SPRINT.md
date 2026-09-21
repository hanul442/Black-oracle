# ACTIVE SPRINT — BOT Alpha Validation Core

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **IN PROGRESS**

## Completed
- BOT-S0 repository boundary bootstrap.
- BOT-S1 scanner input boundary — merged #211.
- BOT-S2 runtime/database ownership contract — merged #212.
- BOT-S3 canonical `bot.validation-experiment.v1` manifest — merged `147a1893f73ebaadc5b8375c9019099ff22e80db`.
- CLEANUP-01 BOT/BOR separation ownership audit — merged `8870dcac57a8b3735c04a3020745ba265f7a5b01`; Black Oracle CI #997 and Trading CI #1176 PASS.

## Active — BOT-S4 Immutable validation stage results / evaluation

### Objective
Create one immutable, fail-closed result contract bound to the canonical BOT-S3 experiment manifest so Backtest, OOS, Walk-Forward, Monte Carlo and execution-cost-stress outputs can be recorded and evaluated without granting strategy promotion, capital allocation or execution authority.

### Acceptance criteria
- Define versioned `bot.validation-stage-result.v1` records bound to `experimentId`, strategy/code/data/engine lineage and exactly one declared validation stage.
- Preserve output fingerprint, completion timestamp, sample/trade counts, return/drawdown/Sharpe-style diagnostics and stage-specific diagnostics without inventing missing values.
- Require one result per required stage; duplicate, missing, mismatched or non-finite results fail closed.
- Define aggregate `PASS / BLOCKED / INSUFFICIENT_DATA` evaluation based on explicit caller-supplied gate outcomes, not hidden research-derived thresholds.
- Stage records and aggregate evaluation carry `promotionAuthority=false`, `executionAuthority=false`, `capitalAuthority=false`.
- Do not mutate PAPER behavior, deterministic Risk, Strategy Factory ranking, Router, Council, portfolio or orders.
- Add repository-native deterministic tests and export through the trading barrel.
- Black Oracle CI + Trading CI green before merge.

### Safety boundary
Validation evidence only. No broker/private Upbit credentials, order submission, position sizing, portfolio mutation, strategy promotion, deterministic Risk bypass, PAPER/LIVE behavior change or unrestricted LIVE authority. Research thresholds remain TEST/REFERENCE until independently adopted.

### Rollback path
Revert the BOT-S4 PR. S0-S3, CLEANUP-01 and existing PAPER/runtime/database state remain unchanged because S4 is additive and persistence-free.

### Exact next gate
`immutable stage result contract + explicit aggregate evaluation + fail-closed tests → CI green → merge BOT-S4 → scanner end-to-end data flow / Strategy Factory validation integration`.

## Research review required before implementation
- **DI-001 / EXP-DI001:** result artifacts must bind to the canonical experiment lineage rather than form a second disconnected ledger.
- **DI-003 / EXP-DI003:** stage outputs inherit point-in-time-safe input lineage; result recording cannot repair unsafe inputs.
- **DI-004 / EXP-DI004:** data snapshot identity must remain replay-addressable through result lineage.
- **EV-001 / EXP-EV001:** engine/version and output fingerprints remain explicit so cross-engine disagreement can be measured later.
- **EV-002 / EXP-EV002:** robustness evidence stays separate from performance ranking.
- **EV-003 / EXP-EV003 + EV-005 / EXP-EV005:** multiple-testing/PBO diagnostics may be recorded but no production cutoff is silently adopted.
- **Q-002 / EXP-Q002:** execution-cost stress is a first-class stage; its assumptions remain bound to the experiment manifest.

Research disposition: **ADOPT schema/lineage constraints only; TEST/REFERENCE for quantitative thresholds. No trading policy adoption.**

## Current deployment state
- Existing legacy PAPER behavior is preserved.
- Independent BOT infrastructure remains a separate provisioning gate.
- No deployment or runtime/database mutation is required for S4.

## Next ordered Alpha work
1. BOT-S4 validation stage results/evaluations — ACTIVE.
2. Scanner end-to-end Upbit KRW data flow.
3. Strategy Factory validation integration.
4. Champion–Challenger + Router/NO_TRADE.
5. Council/Red Team/Arbiter evaluation.
6. deterministic Risk / PAPER / LIVE_SHADOW / Upbit dry-run / reconciliation / kill switch / event ledger / Decision Replay hardening.
