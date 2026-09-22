# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A18 MERGED / FOUNDATION CLOSURE ACTIVE**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay merged.
- BOT-A16 five-surface Alpha IA + global Canonical Ledger merged.
- BOT-A17 release-readiness truth audit merged and identified source-health/freshness blockers.
- BOT-A18 source-truth remediation merged across API contracts and the active Alpha shell.

## Current work package — FOUNDATION-R1 independent BOT runtime attestation
### Objective
Establish a deployable runtime sourced directly from `hanul442/black_oracle_bot` without mutating the protected legacy PAPER qualification services, then attest its exact repository/deployment revision and health state.

### Acceptance criteria
1. Railway service source is exactly `hanul442/black_oracle_bot` on `main`.
2. The service is isolated from legacy PAPER scheduler/writer authority and does not receive broker secrets or new financial authority.
3. Exact deployed revision is observable and health/startup evidence is recorded.
4. Failure to build/start/healthcheck is recorded as BLOCKED rather than worked around by weakening Risk, freshness, auth, or persistence contracts.
5. Existing `black-oracle-paper-vnext`, `black-oracle-paper-s2-shadow`, and `black-oracle-paper-v9-multiasset` remain untouched.

### Safety boundary
No unrestricted LIVE, broker credential injection, deterministic-Risk bypass, scheduler retarget, database migration, protected PAPER-history mutation, qualification reset, or legacy PAPER service disable/repoint. Missing/stale runtime evidence fails closed.

### Rollback path
The new BOT runtime is additive and isolated. If deployment is unhealthy, leave legacy services unchanged and remove/disable only the new isolated service in a later explicitly verified rollback; do not alter canonical PAPER lineage.

### Research / precedent constraints
- `docs/runtime-truth/FOUNDATION_ATTESTATION_2026-09-22.md`: existing Railway services are legacy `hanul442/Black-oracle` runtimes; single-writer proof remains BLOCKED.
- BOT-S9 deterministic Risk boundary and BOT-S11 canary-readiness precedent remain binding: runtime readiness is not execution authority.
- A17/A18 source-truth precedent remains binding: unavailable runtime evidence must be represented as unavailable, never inferred as healthy.
- This package operationalizes existing architecture/runtime separation only; it does not promote research-only behavior into trading production.

## Verification baseline
A18 merge commit: `0a9361c05e5ba0212d7d1bceff032e27ac503ad2`.
- A18 exact PR head passed Black Oracle CI and Trading CI before merge.
- Repository Alpha source-truth: PASS.
- Existing runtime Foundation: BLOCKED / partial evidence.

## Runtime truth before FOUNDATION-R1
Railway project `Black Oracle`, production environment currently exposes four legacy services. `black-oracle-paper-vnext`, `black-oracle-paper-s2-shadow`, and `black-oracle-paper-v9-multiasset` are all sourced from `hanul442/Black-oracle`; none is an independent `hanul442/black_oracle_bot` runtime. Single-writer scheduler/checkpoint lineage remains unproven and therefore BLOCKED.

## Exact next gate
1. provision one isolated Railway service directly from `hanul442/black_oracle_bot` main;
2. verify build/start/health and exact deployed revision without adding broker/scheduler authority;
3. record runtime evidence in the Foundation attestation;
4. only then continue read-only single-writer/control-plane proof.

## Cycle state
- Phase: **FOUNDATION-R1 INDEPENDENT BOT RUNTIME**
- Repository Alpha source-truth: **PASS**
- Runtime Foundation: **BLOCKED / WORK PACKAGE ACTIVE**
- Single next priority: **isolated BOT runtime provision + exact revision attestation**
