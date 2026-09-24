# Frozen v1 Legacy Adapter Pass

Status: **FOUNDATION ADAPTER PASS**

## Principle

Existing BLACK ORACLE history is preserved. Missing Frozen v1 metadata is surfaced as missing rather than reconstructed from guesses.

## BOT

Existing Canonical Event Ledger rows are assessed through:

- legacy temporal projection,
- Decision Replay lineage projection,
- Evidence-reference projection.

A legacy `traceId` remains useful, but the adapter never converts it into a canonical Decision Run because legacy history does not universally prove:

- Point-in-Time observation time,
- canonical data snapshot IDs,
- complete component/version identity.

Coverage can be measured without rewriting rows.

## NARS

Current `nars.evidence.v1` is preserved as the producer boundary.

Its original:

- `event_id`,
- source identities,
- source hashes,
- source publication timestamps,
- run ID,
- ranking-config version

remain valuable.

Frozen v1 ingress must additionally capture:

- BLACK ORACLE `observedAt`,
- `ingestedAt`,
- canonical revision identity,
- source-origin grouping for independence.

NARS rank remains information priority and must never become trade conviction or execution authority.

## BOR

Existing `bor.alpha-read-model.v1` artifacts are reusable under Frozen v1 as versioned Report Artifacts because they already preserve:

- report identity/version/as-of,
- content fingerprint,
- citation Evidence IDs,
- no execution/publication authority.

They are not automatically treated as complete Frozen v1 Decision Runs. Their missing links are explicit:

- Decision Run IDs,
- canonical data snapshot IDs,
- Version Registry reference.

The old rule that BOR must remain a separate top-level product/service is retired. Physical repository/service separation remains an implementation detail until deliberately changed.

## Composition proof

A Foundation integration test now composes:

`Canonical Data → PIT check → Evidence → Material Change → Asset Graph → Decision Run → Shared Evaluation`

and verifies that orchestration/evaluation never gain execution or Production authority.

## Runtime boundary

This adapter pass changes no:

- historical row,
- Supabase schema,
- scheduler,
- Railway service,
- PAPER writer,
- Risk rule,
- live authority.

## Next gate

After CI/merge, Foundation reaches the stage immediately before the **final cross-system audit**.

Per project instruction, stop there and request the planned **Astra final verification pass** before performing that final audit or persistence/runtime migration.
