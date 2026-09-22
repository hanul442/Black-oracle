# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A18 MERGED / FOUNDATION CLOSURE BLOCKED**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay merged.
- BOT-A16 five-surface Alpha IA + global Canonical Ledger merged.
- BOT-A17 release-readiness truth audit merged.
- BOT-A18 canonical source-health remediation merged.

## FOUNDATION-R1 — independent BOT runtime attestation
### Objective
Provision and attest one isolated Railway runtime sourced directly from `hanul442/black_oracle_bot` while preserving all legacy PAPER services and authority boundaries.

### Acceptance criteria / result
- direct BOT repository source: **BLOCKED before creation**
- isolated from legacy PAPER authority: **PASS by no mutation/no service created**
- exact deployed revision + health: **NOT APPLICABLE / no deployment created**
- fail closed rather than weakening contracts: **PASS**
- legacy PAPER services untouched: **PASS**

### Concrete blocker
Railway rejected creation of `black-oracle-bot-alpha` from `hanul442/black_oracle_bot` `main` with: `Free plan resource provision limit exceeded. Please upgrade to provision more resources!` No service or deployment was created.

### Safety boundary preserved
No unrestricted LIVE, broker credential injection, deterministic-Risk bypass, scheduler retarget, database migration, protected PAPER-history mutation, qualification reset, or legacy PAPER service disable/repoint.

### Rollback
No-op: provisioning failed before resource creation.

## Research / precedent review
- BOT-S9: EV-006/EXP-EV006, DI-003/EXP-DI003, DI-004/EXP-DI004 and AIML-002/EXP-AIML002 keep deterministic Risk independent and stale/missing evidence fail-closed.
- BOT-S11: canary readiness is evidence only, never execution/capital/LIVE authority.
- A17/A18: source/runtime truth may not be inferred from missing evidence.
- No research-only strategy, threshold, or model was promoted into production behavior.

## Additional read-only runtime verification
- Existing Railway PAPER services remain sourced from legacy `hanul442/Black-oracle`.
- Supabase management plane reports production `black_oracle` ACTIVE_HEALTHY, but direct SQL still terminates on connection timeout.
- Deployed `black-oracle-paper-scheduler` Edge Function v18 was inspected read-only. It reads `black_oracle_trading_scheduler_config`, requires an enabled row, exact HTTPS approved target and per-runtime scheduler token, and fails closed otherwise.
- v18 approved scheduler targets are limited to legacy web, vnext/vnext-s1r2 and s2-shadow origins. V9 is not on that allowlist, but independent writer behavior remains possible and therefore is not cleared.
- Because the enabled scheduler row and checkpoint/event lineage remain unreadable, **single-writer remains UNKNOWN/BLOCKED**.

## Documentation / verification artifacts
- `docs/runtime-truth/FOUNDATION_ATTESTATION_2026-09-22.md` updated with the Railway capacity blocker and scheduler-v18 source evidence.
- Foundation documentation commits only; trading/runtime contracts unchanged.

## Exact next gate
1. obtain Railway capacity for one additional isolated service (or otherwise free capacity only with explicit safe authority/lineage proof);
2. provision `hanul442/black_oracle_bot` directly and attest exact revision + health;
3. recover read-only Supabase data-plane access and identify the enabled scheduler row + canonical writer/checkpoint lineage;
4. do not advance runtime Foundation to PASS until both independent runtime and single-writer evidence are proven.

## Cycle state
- Phase: **FOUNDATION RUNTIME ATTESTATION**
- Repository Alpha source-truth: **PASS**
- Independent BOT runtime: **BLOCKED — RAILWAY RESOURCE CAPACITY/PLAN**
- Single-writer proof: **BLOCKED — SUPABASE DATA PLANE TIMEOUT**
- Runtime Foundation: **BLOCKED**
- Single next priority: **Railway capacity for isolated BOT runtime, then exact deployment attestation**
