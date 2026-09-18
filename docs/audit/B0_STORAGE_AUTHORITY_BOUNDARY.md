# B0 Storage and Authority Boundary Audit

**Sprint / work packages:** B0 / B0.2, B0.3  
**Observed:** 2026-09-18  
**Method:** sanitized, read-only Supabase catalog and deployed Edge Function inspection  
**Mutation performed:** none

## Decision

B0.3 remains **IN_PROGRESS**. The beta read-only rule is a governing contract, but it is not yet enforced by an isolated database role or beta write namespace.

The current `service_role` is an operational administrator, not a beta read-only identity. A beta adapter using it could mutate 44 of the 47 scoped legacy tables. No `beta`, `report`, `autotrade`, or `black_oracle_beta` schema exists. Therefore neither RLS nor the current grants prove that beta writes cannot reach legacy state.

This finding blocks B0 exit and B1 product implementation. It does not authorize a production grant or schema change.

## Sanitized findings

| Boundary | Observation | B0 interpretation |
|---|---:|---|
| Scoped public tables | 47 | `black_oracle%`, `nars_%`, and `research_%` |
| RLS enabled | 47 / 47 | enabled, but no policies exist on the scoped tables |
| Browser table grants | 0 | `anon` and `authenticated` have no scoped table access |
| `service_role` destructive access | 44 / 47 | cannot represent a beta read-only identity |
| Append-only exceptions | 3 | event and research feature ledgers permit SELECT/INSERT only |
| Beta write namespace | absent | isolation is not yet proven |
| Scoped functions | 35 | seven are security definer functions |
| Browser-executable scoped functions | 1 | `nars_official_series_version(text)`, security invoker helper |
| Scoped views without `security_invoker=true` | 3 | service-only today; harden before broader grants |

The append-only tables are:

- `black_oracle_events`
- `research_feature_observations`
- `research_feature_outcomes`

The views without `security_invoker=true` are:

- `nars_cluster_metrics_v1`
- `nars_cluster_review_queue_v1`
- `nars_story_wire_v1`

None of those three views is readable by `anon` or `authenticated` at this checkpoint. This reduces present exposure but is not a substitute for setting the view security mode before any future product-facing grant.

## Edge Function authority review

Three deployed functions have platform JWT verification disabled:

| Function | Observed authorization | Result |
|---|---|---|
| `nars-shadow-poll` | required custom header compared with a stored SHA-256 value | fail closed when token or stored hash is missing/mismatched |
| `nars-evidence-acquire` | required custom header compared with a stored SHA-256 value | fail closed when token or stored hash is missing/mismatched |
| `black-oracle-runtime-status` | public GET; internal reads use `service_role` | read-only response, but output and runtime-ID enumeration review remains open |

No secret values were read or recorded. Function code was inspected only to classify the authorization path and returned authority.

## Required enforcement contract

B0.3 can pass only after a separately reviewed change proves all of the following:

1. Beta server code uses a dedicated least-privilege identity, never the operational `service_role`.
2. Legacy positions, orders, Ledger, checkpoints, strategy identity, and qualification cohort are SELECT-only through explicit views or functions.
3. New beta-owned data is written only to an explicit beta namespace.
4. The beta identity has no UPDATE, DELETE, TRUNCATE, or ownership path to legacy stores.
5. Security-definer functions pin a safe `search_path`, validate inputs, and are not executable by browser roles unless explicitly required.
6. Product-facing views use `security_invoker=true` and have explicit grants.
7. Negative integration tests attempt and fail every prohibited legacy mutation.
8. Rollback revokes the beta identity and drops only beta-owned objects; it never rewrites legacy data.

## Scope and non-scope

In scope: catalog metadata, grants, RLS/policy counts, view options, function execution grants, and deployed no-JWT function authorization classification.

Out of scope: creating roles or schemas, changing grants/RLS/policies, rotating secrets, rewriting tables, modifying scheduler state, or deploying code.

## Authority, qualification, and lineage impact

- Trading authority remains PAPER ONLY.
- No execution authority was added.
- No position, order, Ledger, checkpoint, strategy identity, qualification cohort, or lineage row was read in full or mutated.
- `UNKNOWN`, stale, failed, and partial states remain distinct from success.

## Rollback

Revert this documentation/manifest/validator commit. Production data and runtime are unchanged.
