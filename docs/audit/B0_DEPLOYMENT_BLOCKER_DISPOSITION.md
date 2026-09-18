# B0.6 Deployment Blocker Disposition

**Sprint / work package:** B0 / B0.6  
**Decision:** explicit carry-forward; no cutover and no generic redeploy  
**Observed:** 2026-09-18T23:41:00Z

## Outcome

B0.6 is dispositioned as `CARRIED_FORWARD_BLOCKED`. This satisfies the Master Plan requirement to close or explicitly carry forward the S2 stale-source and vNext revision blockers, but it does not clear the blockers, pass B0, or authorize B1 production behavior.

## vNext

- configured source pin: `7c5bfd09297ad8497312b372f60386aeb7cfedcd`;
- latest deployed metadata: `8933516036f0910634fd53e97df1e81cc54637ea`;
- latest deployment status: `SUCCESS`, which is deployment completion only;
- runtime logs contain HTTP 409 contention, HTTP 500 cycles, checkpoint-abort rollback, and a lease-release 504;
- runtime health: `NOT_READY`.

The connected Railway redeploy operation cannot select or prove an exact commit. Triggering it could repeat the mismatched snapshot, so it is prohibited.

## S2 shadow

- repository is configured, but branch and commit SHA are unpinned;
- the latest deployment is a redeploy of `8c2f27aa53345a9738847e05f204cd38cf393d02`;
- repeated redeploy metadata demonstrates snapshot reuse rather than latest-source proof;
- logs contain KRX timeouts and canonical append 503/521 failures. Some cycles return zero candidates with `executionAuthority=false`, which is not readiness;
- runtime health: `DEGRADED`.

Generic redeploy is prohibited because it repeats the stale snapshot and does not establish source truth.

## Required resolution evidence

For each service, a future deployment must provide all of the following:

1. exact requested commit SHA before deployment;
2. deployment metadata SHA equal to the request;
3. runtime-reported revision equal to the deployment SHA;
4. semantic health based on fresh persisted state, not HTTP 200 or Railway `SUCCESS`;
5. zero recent persistence/cycle errors within a declared observation window;
6. an exact rollback artifact verified before cutover;
7. no checkpoint, qualification identity, position, order, or Ledger rewrite.

S2 additionally requires an explicit source branch and commit pin. vNext must preserve its qualification tuple and cannot be rearmed or rekeyed.

## Authority and rollback

No deployment, configuration, scheduler, database, credential, position, order, Ledger, checkpoint, or qualification mutation was performed. The current rollback action is therefore `NO_CHANGE`. A future deployment is not authorized until its exact previous artifact is available and verified.

The machine-readable disposition is `ops/b0-deployment-blocker-disposition.json` and is fail-closed by `scripts/verify-b0-deployment-blocker-disposition.mjs`.
