# BLACK ORACLE — Sprint 6 Qualification Release Preflight

Status: DRAFT / READ-ONLY / PAPER ONLY

## Purpose

This gate prevents BLACK ORACLE from treating a Preview deployment, stale revision, incomplete Qualification Window pin, or local/non-durable runtime as an eligible source of fresh PAPER qualification credit.

It is a read-only assessment. It does not deploy code, update Supabase, change the scheduler, arm a qualification window, start a PAPER cycle, or grant exchange execution authority.

## Inputs

The release guard reads only deployment/runtime metadata:

- `TRADING_PERSISTENCE_BACKEND`
- `VERCEL_ENV`
- `VERCEL_GIT_COMMIT_SHA`
- `PAPER_QUALIFICATION_WINDOW_ID`
- `PAPER_QUALIFICATION_ARMED_AT`
- `PAPER_QUALIFICATION_SOURCE_REVISION`

Secret values are not required or returned by this evaluator.

## Required conditions for qualification start readiness

All structural conditions must pass:

1. persistence backend is `supabase`
2. Vercel environment is exactly `production`
3. deployed commit SHA is available
4. all three Qualification Window pin values are configured and valid
5. `PAPER_QUALIFICATION_SOURCE_REVISION` exactly equals `VERCEL_GIT_COMMIT_SHA`
6. configured arming time has been reached

## States

### `BLOCKED`
At least one structural requirement is missing or mismatched.

Possible blockers:
- `PERSISTENCE_NOT_SUPABASE`
- `DEPLOYMENT_ENV_NOT_PRODUCTION`
- `DEPLOYED_REVISION_MISSING`
- `WINDOW_PIN_NOT_CONFIGURED`
- `WINDOW_PIN_INVALID`
- `PIN_REVISION_MISMATCH`

### `ARMED_PENDING_TIME`
The production environment and exact revision pin are structurally correct, but the configured arming timestamp has not yet been reached.

This state still has `readyForQualificationStart=false`.

### `READY_FOR_FIRST_QUALIFYING_CYCLE`
The production deployment is exact-revision pinned, durable persistence is enabled, the full qualification pin is valid, and the arming timestamp has been reached.

This still does **not** start the qualification window. The existing Qualification Window logic must then observe a clean source-backed governed PAPER cycle before the persisted window can move from `ARMED` to `COLLECTING`.

## Preview boundary

A Vercel Preview may be used for API/UI/runtime QA, but it can never become `READY_FOR_FIRST_QUALIFYING_CYCLE` because `VERCEL_ENV` is not `production`.

This deliberately separates:

`Preview verification` -> `human rollout approval` -> `production exact revision` -> `qualification arm` -> `first source-backed governed cycle` -> `fresh empirical clock`

## Authority boundary

Every result includes:

- `deploymentAuthority=false`
- `qualificationStartAuthority=false`

The gate is evidence for a human rollout decision, not an actuator.
