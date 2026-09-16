# BLACK ORACLE Active Sprint

## Sprint
- **ID:** BO-P0-KRX-TRUTH-01
- **Title:** Korea Equity canonical producer truth and production verification

## Objective
Make the KRX account-free research path truthfully distinguish upstream/source emptiness, filtering/Committee emptiness, nomination blocking, and canonical persistence failures, then verify that truth on the isolated S2 Shadow production runtime without changing trading authority or the protected S1R2 qualification runtime.

## User-visible outcome
Korea Equity observability no longer conflates `0 Committee candidates` with `0 KRX instruments`, and operator/runtime state reports whether failure is in research or canonical persistence before downstream Markets repair continues.

## Acceptance criteria
- KRX scheduler distinguishes SOURCE_EMPTY, VOLUME_PREFILTER_EMPTY, PROFILE_EMPTY, COMMITTEE_EMPTY, NOMINATION_BLOCKED, and NOMINATION_READY.
- Research-cycle failures and canonical-append failures are reported separately.
- A research cycle is promoted to latest successful scheduler truth only after canonical events persist successfully.
- Existing market-data provenance and execution-suitability semantics remain unchanged.
- Risk, Router, Council authority, execution gates, portfolio authority, and protected S1R2 qualification state remain unchanged.
- Relevant CI/typecheck/trading/runtime/build checks are green.
- S2 Shadow runs an exact revision containing PR #173 and production telemetry is verified before this sprint is DONE.

## Current phase
DEPLOY

## Completed checkpoints
- DISCOVER: Production logs showed `0 candidate(s)` was Committee output, not proof of an empty KRX universe; canonical append also showed Supabase/Cloudflare failures.
- PLAN: Limited repair to scheduler truth/observability; no source/filter/threshold/execution semantic changes.
- IMPLEMENT: Added KRX research truth classification and canonical-persistence-aware scheduler state.
- TEST: Black Oracle CI and Trading CI passed, including typecheck, trading core/regression tests, Supabase function typecheck, runtime bundle, scheduler smoke tests, and production build.
- REVIEW: Diff constrained to KRX scheduler truth and regression coverage; protected invariants unchanged.
- MERGE: PR #173 merged as `520270c467da3d15cc46262fda836e26fefca755`.
- STATE: Canonical scheduler state file created and is persistent.
- DEPLOY DISCOVERY: S2 Shadow remained SUCCESS on stale `8c2f27aa53345a9738847e05f204cd38cf393d02`.
- DEPLOY BLOCKER PROOF: On 2026-09-16, a low-risk S2-only Railway redeploy was used specifically to test whether the service would refresh its GitHub source. Railway created deployments `1dc14e37-29c7-47db-b33b-121b5dc10f0e` and `fa1c9937-32fb-482c-8260-ceef6ff44266`; both metadata explicitly resolve to commit `8c2f27aa53345a9738847e05f204cd38cf393d02`, proving generic redeploy reuses the stale source snapshot and cannot satisfy exact-revision deployment. No further redeploy should be attempted for this blocker.

## Next checkpoint
Resolve the exact-revision S2 source blocker through a mechanism that creates a fresh GitHub source revision for the existing S2 service without changing secrets or protected runtimes. Do not use generic redeploy again. Once a revision containing #173 is proven, deploy/verify S2 and inspect KRX disposition plus `RESEARCH_CYCLE` / `CANONICAL_APPEND` telemetry.

## Blockers
- **ACTIVE / PROVEN:** Railway generic redeploy reuses S2's stale `8c2f27aa...` source snapshot. The current Railway service configuration surface does not expose source-branch/commit mutation for the existing service.
- Exact revision containing #173 cannot currently be guaranteed through the available safe Railway mutation surface.
- Do not treat deployment SUCCESS as revision correctness.
- Do not mutate secrets, S1R2, qualification logic, or trading authority to work around this blocker.

## Relevant PR / branch
- PR #173 — merged.
- Merge commit: `520270c467da3d15cc46262fda836e26fefca755`.
- Protected qualification work such as PR #115 remains isolated and is not part of this sprint.

## Validation status
GREEN for merged #173 scope. Production verification pending exact-revision S2 deployment. Generic redeploy behavior is now empirically verified as stale-snapshot reuse.

## Deploy status
BLOCKED. S2-only redeploy test initiated two builds, but both explicitly target stale commit `8c2f27aa53345a9738847e05f204cd38cf393d02`; therefore neither qualifies as the required deployment containing #173. No secret/config/trading mutation occurred.

## Protected invariants
- Protected ₩100M S1R2 Paper qualification runtime/sample untouched.
- No real-money trading authority changes.
- No Risk/Router/Council/Execution hard-gate relaxation.
- No fabricated market data, Evidence, Council participation, Monte Carlo metrics, prices, or lineage.
- No destructive migration, secret mutation, portfolio/account mutation, or canonical-ledger semantic rewrite.

## Next action
Stay in DEPLOY. Find or establish a fresh-source deployment mechanism for the existing S2 service that can prove a revision containing #173. Generic redeploy is now ruled out. After exact revision is proven, VERIFY KRX runtime telemetry and advance to DONE only if acceptance criteria pass.
