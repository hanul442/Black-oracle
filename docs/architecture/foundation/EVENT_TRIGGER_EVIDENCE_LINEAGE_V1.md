# Event / Trigger + Evidence Lineage v1

Status: **FOUNDATION IMPLEMENTATION / ADDITIVE**

## Why these are one slice

Frozen v1 requires one material-change stream to drive selective recomputation and one Evidence lineage model to explain why downstream artifacts changed.

Separating them into new top-level engines would recreate the architecture sprawl that Frozen v1 explicitly retired.

## Event / Trigger contract

A material-change event records:

- exact source record/revision,
- when the change was observed and emitted,
- affected entities,
- materiality,
- explicit recomputation targets,
- reason codes.

Orchestration has **no execution authority**.

It may ask Research / Forecast / Strategy / Report / Watchlist / Alert / Asset Graph to recompute. It cannot directly authorize an order.

### Silent changes

`SILENT` changes may refresh internal state but cannot request `ALERT`.

This supports the Frozen v1 rule that tiny changes update silently.

## Evidence lineage

Every new PIT-grade Evidence Artifact requires:

- canonical data logical record + revision identity,
- content fingerprint,
- source identity,
- origin-group lineage,
- verification state,
- contradiction state,
- observed / ingested time,
- affected entities.

`originGroupId` prevents repeated republication of one source from being counted as independent corroboration.

Revoked Evidence requires an explicit invalidation timestamp.

Dependencies may link Evidence to:

- Research,
- Forecast,
- Report,
- Decision Run.

When Evidence is revised/revoked, the impact set identifies exactly which downstream artifacts require review.

## Legacy boundary

Existing Canonical Ledger `EVIDENCE` events often preserve only Evidence IDs. The compatibility projection retains those IDs but returns `LEGACY_REFERENCE_ONLY`; it never invents provenance, verification, temporal, or revision metadata.

## Safety

No DB migration, event writer cutover, scheduler change, Risk/PAPER mutation, alert delivery, or LIVE authority is introduced here.

## Next

- PAPER-safe shared Evaluation interface
- Market / Asset Graph foundation
- then producer adapters that emit these contracts without changing decision authority.
