# ACTIVE SPRINT — BOT Alpha Risk / Execution Boundary

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **S8 COMPLETE / S9 ACTIVE**

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
- BOT-S8 Council / Red Team / Arbiter governance — merged #221 as `70735bc9765cab9be9021ce5f430d2c849da3e2e`.

## BOT-S9 — deterministic Risk + PAPER/LIVE_SHADOW execution boundary

### Objective
Bind S8 governance outcomes to an explicit deterministic Risk decision contract and mode-aware execution boundary. `NO_TRADE` remains terminal. Governance approval alone never authorizes an order. Alpha exposes bounded PAPER/LIVE_SHADOW intent only, with auditable lineage and fail-closed freshness/identity handling.

### Acceptance criteria
- deterministic Risk is mandatory after governance and cannot be bypassed by agents, Council, Router or frontend inputs.
- `NO_TRADE` / governance rejection cannot be upgraded downstream.
- missing, stale, future or identity-mismatched risk inputs fail closed.
- Alpha execution mode is explicit and restricted to `PAPER | LIVE_SHADOW`; unrestricted LIVE is rejected.
- resulting order intent is non-broker-authoritative and carries `executionAuthority=false`, `capitalAuthority=false`, `liveAuthority=false`.
- risk/governance/router/strategy lineage and reason codes are replayable.
- no broker secret appears in the contract.
- existing PAPER runtime behavior remains untouched by S9.

### Safety boundary
No unrestricted LIVE, no broker-secret exposure, no agent-controlled risk override, no implicit capital authority, no destructive runtime/database migration, no broker submission, and no mutation of the existing PAPER runtime. Fail closed on stale or missing data.

### Rollback path
Repository-only revert of the S9 branch/merge. S0-S8 and existing PAPER/runtime/database state remain unchanged.

### Research constraints recorded before implementation
- **EV-006 / EXP-EV006** — bounded autonomy requires a separately testable deterministic pre-trade gate; strategy/Council/router/LLM cannot bypass it.
- **DI-003 / EXP-DI003** — point-in-time freshness/knowledge semantics must be explicit and fail closed.
- **DI-004 / EXP-DI004** — decision evidence must remain snapshot-addressable/replayable.
- **AIML-002 / EXP-AIML002** — provenance/TEVV evidence is trace data, not execution authority.
- **S8 precedent** — governance `APPROVE` only means evidence is sufficient for the next deterministic gate; it is not order authorization.
- Existing Event Ledger and Decision Replay implementations are precedents for lineage/replay only; S9 does not silently wire them into production runtime.

No research threshold, model score, external strategy, or claimed performance result is promoted into production behavior.

### Exact next gate
Implement one additive authority-free `bot.risk-execution-boundary.v1` contract + deterministic tests → document the contract/research disposition → verify exact commit and both required CI workflows → merge only if green. Deployment only if a verified runtime change is required; S9 is designed not to require one.

## Current deployment state
No S9 deployment planned. Existing legacy Railway/PAPER services remain unchanged; BOT repository/runtime/database separation remains preserved.

## Cycle state
- Phase: **BOT-S9 PLAN + RESEARCH REVIEW COMPLETE / IMPLEMENTING**
- Open unrelated PRs observed: #222 UI Thinking Orbs; legacy/report/research PRs remain outside frozen BOT Alpha S9 scope.
- Blockers: none for additive S9 contract.
- Single next priority: **implement deterministic authority-free Risk + PAPER/LIVE_SHADOW boundary and verify CI**.
