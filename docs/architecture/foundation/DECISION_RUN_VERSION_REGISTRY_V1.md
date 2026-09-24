# Decision Run + Version Registry v1

Status: **FOUNDATION IMPLEMENTATION / ADDITIVE**

## Decision Run

Every new Frozen v1 official decision cycle receives a canonical immutable identity.

The identity binds:

- runtime,
- market,
- exact `asOf` cutoff,
- caller-owned decision key,
- exact component versions,
- canonical data snapshot IDs,
- Evidence IDs,
- Research / Forecast artifact IDs where available,
- Portfolio snapshot where applicable.

Changing a material component version changes the Decision Run identity.

Existing Decision Replay `traceId` / `decisionId` values remain valuable compatibility lineage, but they are **not automatically promoted** into Decision Run IDs because legacy traces do not universally prove:

- canonical data snapshot identity,
- Point-in-Time knowledge cutoff,
- complete component versions.

## Version Registry

Version identity is independent from deployment authority.

Two orthogonal axes are explicit:

Validation:

`UNVALIDATED → CANDIDATE → CHALLENGER → CHAMPION → DORMANT / RETIRED`

Deployment:

`OFFLINE → PAPER_SHADOW → PRODUCTION`

A Champion may remain OFFLINE or PAPER_SHADOW.

PRODUCTION requires an explicit `productionActivationId`; Champion status alone can never create Production authority.

## Safety

This slice adds pure contracts/tests only.

It does not:

- persist registry rows,
- alter canonical events,
- change Strategy/Champion behavior,
- change scheduler/PAPER/Risk,
- activate Production,
- change Railway or Supabase.

## Next

The next Foundation slice should define the shared Event / Trigger contract and bind new canonical events to the Decision Run identity without rewriting legacy history.
