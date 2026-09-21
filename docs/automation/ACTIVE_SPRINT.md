# ACTIVE SPRINT — BOT-S8 Council / Red Team / Arbiter Governance

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **S8 IMPLEMENTED / CI GATE**

## Completed
- BOT-S0 repository boundary bootstrap.
- BOT-S1 scanner input boundary — merged #211.
- BOT-S2 runtime/database ownership contract — merged #212.
- BOT-S3 canonical validation experiment manifest — merged.
- CLEANUP-01 separation ownership audit — merged.
- BOT-S4 immutable validation stage results/evaluation — merged #215.
- BOT-S5 end-to-end Upbit KRW scanner flow — merged #216.
- BOT-S6 Strategy Factory validation integration — merged #219.
- BOT-S7 Champion–Challenger + Strategy Router / NO_TRADE — merged #220.

## BOT-S8 work package

### Objective
Add an authority-free deterministic governance contract consuming S7 Router output plus explicit Council and Red Team findings. A Router selection is preserved only when required governance evidence is fresh, identity-consistent and non-vetoing; all bounded insufficiency resolves to `NO_TRADE`.

### Acceptance criteria / implementation result
- Router `NO_TRADE` is terminal and cannot be upgraded.
- Council and Red Team findings carry source ID, strategy identity/revision, observed time, max age, verdict and evidence fingerprints.
- missing governance evidence, stale/future evidence, identity mismatch, Council rejection and Red Team veto fail closed to `NO_TRADE`.
- malformed evidence and any attempted authority escalation are rejected.
- output preserves Router reason plus governance evidence for replay/audit.
- `promotionAuthority=false`, `executionAuthority=false`, `capitalAuthority=false`, `riskBypassAuthority=false`, `liveAuthority=false`.
- deterministic Risk remains mandatory downstream; no order/PAPER/runtime/database/LIVE behavior changed.

### Research reviewed
AIML-002/EXP-AIML002, AIML-003/EXP-AIML003, AIML-004/EXP-AIML004, AIML-005/EXP-AIML005, AIML-006/EXP-AIML006, DI-003/EXP-DI003, DI-004/EXP-DI004, EV-006/EXP-EV006 and S7 precedent. Research record: `docs/research/2026-09-21-s8-governance-contract.md`. No research numerical cutoff, model score or external strategy was promoted.

### Safety boundary
Governance `APPROVE` means only that bounded governance evidence is sufficient for the next deterministic gate; it is not execution authorization. No order submission, capital allocation, Champion mutation, broker-secret access, deterministic Risk bypass or unrestricted LIVE.

### Rollback path
Repository-only revert of S8. S0-S7, PAPER behavior, runtime and database remain unchanged.

### Exact next gate
Open PR → verify exact PR head and both required GitHub CI workflows → fix failures if any → merge only if green → update this record with exact CI/merge evidence. No deployment is required for this additive contract.

## Current deployment state
No deployment required. Existing legacy Railway/PAPER services remain unchanged; repository/runtime/database separation remains preserved.

## Cycle state
- Phase: **BOT-S8 IMPLEMENTED / CI GATE**
- Blockers: none before CI
- Alpha status: S0-S7 complete; S8 implemented
- Single next priority: **obtain exact-head Black Oracle CI + Trading CI green and merge S8 only when verified**
