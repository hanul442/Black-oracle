# ACTIVE SPRINT — BOT-S8 Council / Red Team / Arbiter Governance

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **S8 IN PROGRESS**

## Completed
- BOT-S0 repository boundary bootstrap.
- BOT-S1 scanner input boundary — merged #211.
- BOT-S2 runtime/database ownership contract — merged #212.
- BOT-S3 canonical validation experiment manifest — merged.
- CLEANUP-01 separation ownership audit — merged.
- BOT-S4 immutable validation stage results/evaluation — merged #215.
- BOT-S5 end-to-end Upbit KRW scanner flow — merged #216.
- BOT-S6 Strategy Factory validation integration — merged #219.
- BOT-S7 Champion–Challenger + Strategy Router / NO_TRADE — merged #220 as `ca79421e27843f5bde9fa26f77c1c775a9136a5d`.

## BOT-S8 PLAN

### Objective
Add an authority-free deterministic governance contract that consumes an S7 Router decision plus explicit Council and Red Team findings and emits an auditable Arbiter outcome. Governance may preserve a valid router selection only when all required evidence is fresh, internally consistent and non-vetoing; otherwise it resolves to explicit `NO_TRADE`.

### Acceptance criteria
1. Input must carry an S7 `bot.champion-challenger-router.v1` decision and exact selected strategy identity when Router action is `SELECT`.
2. Router `NO_TRADE` is terminal for S8 and cannot be upgraded by Council, Red Team or Arbiter.
3. Council and Red Team findings have explicit source IDs, observed timestamps, max-age bounds, strategy identity/revision, verdict and evidence fingerprints.
4. Missing, stale/future, malformed, identity-mismatched or contradictory governance evidence fails closed to `NO_TRADE`.
5. Any Red Team veto resolves `NO_TRADE`; Arbiter cannot override it.
6. Council non-approval or disagreement resolves `NO_TRADE`; no hidden majority or confidence threshold is introduced.
7. Output preserves Router/Council/Red-Team lineage and deterministic reason codes for Decision Replay.
8. `promotionAuthority=false`, `executionAuthority=false`, `capitalAuthority=false`, `riskBypassAuthority=false`, `liveAuthority=false` are immutable.
9. No order submission, capital allocation, Champion mutation, PAPER mutation, broker-secret access, Risk bypass or unrestricted LIVE behavior.
10. Deterministic tests cover pass-through approval, terminal Router NO_TRADE, missing/stale/future evidence, identity mismatch, Council rejection, Red Team veto, malformed evidence and authority escalation.
11. Both required GitHub CI workflows must be green before merge.

### Safety boundary
S8 is governance evidence/proposal plumbing only. It cannot create trading authority or turn research findings into production thresholds. Deterministic Risk remains mandatory downstream of any governance `APPROVE` outcome. Existing PAPER/runtime/database/deployment behavior remains unchanged.

### Rollback path
Repository-only revert of the S8 merge. S0-S7, existing PAPER behavior, runtime and database remain unchanged.

### Exact next gate
Record relevant research IDs/precedents in an S8 research review → implement one bounded governance contract + deterministic tests → verify exact PR head and both required CI → merge only if green → no deployment unless a separately verified runtime integration requires it.

## Research review constraints
Pending bounded review of AIML-002/003/004/005/006, DI-003/004, EV-006 and S7 precedent. No research numerical cutoff or model output becomes authority without a separate experiment/adoption record.

## Current deployment state
No S8 deployment is authorized or required by this bounded repository package. Existing legacy Railway/PAPER services remain unchanged. BOT repository/runtime/database separation remains preserved.

## Cycle state
- Phase: **BOT-S8 PLAN COMPLETE / RESEARCH REVIEW NEXT**
- Blockers: none for bounded repository contract
- Alpha status: S0-S7 complete; S8 active
- Single next priority: **complete S8 research review, implement deterministic governance fail-closed contract, then verify required CI**
