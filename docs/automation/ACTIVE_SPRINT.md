# ACTIVE SPRINT — BOT Separation Cleanup

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **IN PROGRESS**

## Completed
- BOT-S0 repository boundary bootstrap.
- BOT-S1 scanner input boundary — merged #211.
- BOT-S2 runtime/database ownership contract — merged #212.
- BOT-S3 canonical validation experiment manifest — CI green and merged as `147a1893f73ebaadc5b8375c9019099ff22e80db`.

## Active — CLEANUP-01 Legacy separation audit

### Objective
Remove legacy ownership ambiguity before S4 without deleting historical evidence or merging stale combined-product branches.

### Acceptance criteria
- Close clearly superseded BOT PR #209.
- Inventory legacy PRs as SUPERSEDED / MIGRATION SOURCE / REIMPLEMENTATION SOURCE / PROTECTED REFERENCE.
- Fix canonical ownership: trading/execution in BOT; source/evidence/report research in BOR.
- Defer non-Alpha commercial experiments.
- Preserve rollback/history and prohibit direct BOT↔BOR database coupling.

### Research / precedent review
- DI-001 / DI-003 / DI-004 remain canonical lineage/replay constraints.
- Existing Report-first Migration Map v1 from legacy PR #200 is used as historical migration precedent only.
- AIML-005 / AIML-006 remain evaluation gates, not production-agent authority.

### Safety boundary
Documentation/PR hygiene only. No PAPER mutation, runtime/database provisioning, broker credentials, orders, strategy behavior, Risk policy or LIVE authority changes.

### Rollback
Git history is unchanged. Reopen a closed legacy PR or revert cleanup documentation if classification proves incorrect.

### Exact next gate
Cleanup PR CI green → merge → **BOT-S4 immutable validation stage-result/evaluation records**.

## Next ordered Alpha work
1. BOT-S4 validation stage results/evaluations.
2. Scanner end-to-end data flow.
3. Strategy Factory validation integration.
4. Champion–Challenger and Router/NO_TRADE.
5. Council/Red Team/Arbiter evaluation.
6. Risk/execution/reconciliation/Decision Replay hardening.
