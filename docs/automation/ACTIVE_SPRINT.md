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
- DEPLOY BLOCKER PROOF: On 2026-09-16, a low-risk S2-only Railway redeploy was used specifically to test whether the service would refresh its GitHub source. Railway created deployments `1dc14e37-29c7-47db-b33b-121b5dc10f0e` and `fa1c9937-32fb-482c-8260-ceef6ff44266`; both metadata explicitly resolve to commit `8c2f27aa53345a9738847e05f204cd38cf393d02`, proving generic redeploy reuses the stale source snapshot and cannot satisfy exact-revision deployment. No further generic redeploy should be attempted for this blocker.
- DEPLOY PATH DISCOVERY: Railway's current official GitHub autodeploy documentation explicitly distinguishes generic redeploy from **Deploy Latest Commit**. For a service linked to a GitHub branch, Command Palette (`CMD + K`) -> `Deploy Latest Commit` creates a deployment from the latest commit on the connected branch. The same docs say a linked service should autodeploy on new branch commits and list disabled autodeploy/GitHub permissions/watch paths as troubleshooting causes when it does not. This identifies the correct fresh-source mechanism and the likely integration fault class.

## Next checkpoint
Execute Railway **Deploy Latest Commit** for the existing S2 Shadow service (not generic redeploy), then verify deployment metadata contains a GitHub revision that includes PR #173. If that control is unavailable or fails, repair/reconnect S2's GitHub autodeploy integration in Railway service settings without changing secrets/runtime variables. Once exact revision is proven, inspect KRX disposition plus `RESEARCH_CYCLE` / `CANONICAL_APPEND` telemetry.

## Blockers
- **ACTIVE / TOOL-SURFACE:** The connected Railway tool exposes generic `redeploy` but does not expose the documented `Deploy Latest Commit` control or GitHub autodeploy enable/reconnect settings for an existing service.
- **PROVEN:** Generic redeploy reuses S2's stale `8c2f27aa...` source snapshot and must not be used again for this purpose.
- S2 has not autodeployed on recent `main` commits despite Railway documentation stating linked GitHub services normally do; likely fault classes are disabled autodeploy, GitHub permission/integration state, or watch-path configuration. Exact cause requires the Railway service-settings control surface.
- Do not treat deployment SUCCESS as revision correctness.
- Do not mutate secrets, S1R2, qualification logic, or trading authority to work around this blocker.

## Relevant PR / branch
- PR #173 — merged.
- Merge commit: `520270c467da3d15cc46262fda836e26fefca755`.
- Current GitHub main at deployment-path discovery: `8307d563a303181fd92c7e2e9b0b55880776b169` (contains #173).
- Protected qualification work such as PR #115 remains isolated and is not part of this sprint.

## Validation status
GREEN for merged #173 scope. Production verification pending exact-revision S2 deployment. Generic redeploy behavior is empirically verified as stale-snapshot reuse; official Railway documentation now identifies `Deploy Latest Commit` as the required fresh-source operation.

## Deploy status
BLOCKED ON RAILWAY CONTROL SURFACE. S2 latest successful redeploy `fa1c9937-32fb-482c-8260-ceef6ff44266` is stale commit `8c2f27aa53345a9738847e05f204cd38cf393d02`. No further deployment mutation was performed after identifying the documented fresh-source operation because the available connector does not expose it.

## Protected invariants
- Protected ₩100M S1R2 Paper qualification runtime/sample untouched.
- No real-money trading authority changes.
- No Risk/Router/Council/Execution hard-gate relaxation.
- No fabricated market data, Evidence, Council participation, Monte Carlo metrics, prices, or lineage.
- No destructive migration, secret mutation, portfolio/account mutation, or canonical-ledger semantic rewrite.

## Next action
Stay in DEPLOY. Use Railway's documented **Deploy Latest Commit** operation for S2 Shadow when that service-settings/Command Palette surface is available; otherwise restore S2 GitHub autodeploy integration (enable/reconnect/permissions/watch-path check) without changing secrets. Then verify exact deployed SHA, inspect KRX telemetry, and advance to VERIFY/DONE only if acceptance criteria pass.
