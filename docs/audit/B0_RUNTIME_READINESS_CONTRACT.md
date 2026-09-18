# B0 Runtime Readiness Contract

**Sprint / work packages:** B0 / B0.1, B0.2  
**Status:** source implemented; deployment pending exact-SHA verification  
**Production mutation:** none

## Decision

Transport success, deployment `SUCCESS`, HTTP 200, a recent scheduler invocation, or `last_ok=true` is not sufficient readiness evidence.

A runtime is ready only when the status policy positively proves every required condition:

1. an allowed public runtime ID was requested;
2. a checkpoint was actually persisted;
3. that checkpoint is within the 25-minute freshness window;
4. where the legacy scheduler is required, it is enabled and recently invoked;
5. the scheduler recorded `last_ok=true` and a 2xx downstream status;
6. the latest cycle has no recorded errors;
7. the Evidence attachment audit did not fail.

Anything missing stays `UNKNOWN`, `STALLED`, `BLOCKED`, or `DEGRADED`. It never becomes zero, success, or ready by default.

## State semantics

| State | `ready` | Meaning |
|---|---:|---|
| `RUNNING` | true | Fresh persisted checkpoint plus every required scheduler and cycle invariant |
| `DEGRADED` | false | Recent data exists, but scheduler HTTP status, cycle errors, or Evidence audit fails readiness |
| `STALLED` | false | Checkpoint or required scheduler evidence is older than the allowed window |
| `BLOCKED` | false | Required scheduler is disabled |
| `UNKNOWN` | false | Required checkpoint or scheduler source-of-truth is missing |

HTTP 409 is explicitly `DEGRADED`, even when the legacy scheduler stored `last_ok=true`. A scheduler heartbeat cannot refresh checkpoint age.

## Public output boundary

The unauthenticated status function may expose only:

- `black-oracle-paper`
- `black-oracle-paper-native-shadow`

Qualification, experimental, and internal runtime IDs return the same 404 response. This prevents the public endpoint from becoming a runtime-enumeration surface.

The function uses `service_role` only inside the server-side execution scope and returns bounded aggregate status. It never returns checkpoint JSON, positions, orders, Ledger entries, secrets, strategy identity, or qualification cohort data.

## Verification

The pure policy regression suite covers:

- fresh checkpoint plus recent accepted scheduler;
- 409 with `last_ok=true`;
- stale checkpoint plus fresh scheduler heartbeat;
- missing checkpoint;
- disabled scheduler;
- upstream 503/failure;
- cycle errors and Evidence attachment failure;
- native shadow without legacy scheduler dependency;
- rejection of internal and qualification runtime IDs.

The canonical ledger scheduler classifier applies the same 2xx requirement, preventing another read model from reporting 409 or missing HTTP status as healthy.

## Deployment gate

Do not deploy from this document or from a branch ref. Deployment requires:

1. PR head CI and Deno typecheck pass;
2. merge to main;
3. exact merged commit SHA recorded;
4. deployed Edge Function source SHA-256 recorded;
5. public allowlist and 409/stale/missing-checkpoint probes pass;
6. deployed response reports `BO-RUNTIME-STATUS-v0.3`;
7. rollback target remains deployed v3, SHA-256 `02c0896d442d39acf77b898c001678ba692f8d1b4de9ad6a86d590d99c8f48bb`.

Until all seven conditions pass, production remains on v3 and B0 readiness remains unresolved.

## Scope and non-scope

In scope: pure readiness policy, public runtime allowlist, status response semantics, canonical scheduler classification, tests, and deployment/rollback contract.

Out of scope: deploying the function, changing scheduler rows, rewriting checkpoints, granting execution authority, changing trading logic, or modifying qualification state.

## Authority and lineage impact

- PAPER ONLY remains unchanged.
- `ready` is observability only and grants no execution or qualification authority.
- Report and AutoTrade remain independent.
- Deterministic Risk is unchanged and cannot be bypassed.
- Existing positions, orders, Ledger, checkpoints, strategy identity, and qualification cohorts remain read-only.
