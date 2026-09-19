# Cycle 004 — Point-in-Time Feature Integrity

Date: 2026-09-20
Status: TEST
Research IDs: DI-003, EV-005
Production impact: None

## Executive summary

BLACK ORACLE already records information horizons and dataset fingerprints in the `bo.experiment.v1` candidate, but this is not sufficient to prove that a feature row was actually available at the decision timestamp. A market research system can have a correct split manifest and still leak revised fundamentals, delayed vendor fields, post-close aggregates, or features materialized with future information.

This cycle proposes a **point-in-time feature contract**: every decision-facing feature should be reconstructable as-of a decision timestamp using both event time and availability/knowledge time where relevant.

## External precedent

Feast documents point-in-time historical joins that reconstruct feature values at a specified past event timestamp rather than joining the latest value. This is strong infrastructure precedent for BLACK ORACLE, but BO needs additional market-specific semantics for publication delay, corrections, exchange sessions, vendor arrival time and corporate-action revisions.

Source: https://docs.feast.dev/getting-started/concepts/point-in-time-joins

Evidence quality: A- (official project documentation; implementation precedent, not evidence of BO correctness).

## Gap against BLACK ORACLE

`bo.experiment.v1` records information horizons and exact split manifests, but the research substrate still needs an explicit feature-availability contract. A dataset hash proves identity, not causal availability.

Required fields proposed for a feature observation:

- `instrument_id`
- `feature_id` / `feature_schema_version`
- `event_time`
- `available_time` or `knowledge_time`
- `source_time`
- `ingested_at`
- `revision_id` where applicable
- `session/calendar_version`
- `transform_code_hash`
- `upstream_dataset_snapshot_id`

## Hypothesis

If BLACK ORACLE enforces point-in-time retrieval using availability-aware timestamps, seeded future-information features and revised values will be excluded from historical decisions while legitimate historical features remain reproducible.

## Experiment — EXP-DI003

Build a sandbox fixture with one KRX and one crypto path. Seed four failure modes:

1. future price-derived feature,
2. delayed fundamental/news feature,
3. revised observation whose latest value differs from the historical value,
4. exchange-session boundary error.

Replay the same historical decision timestamp through naive latest-value retrieval and point-in-time retrieval.

### Success metrics

- 100% of seeded leakage cases blocked or correctly time-shifted.
- 0 unexpected future timestamps in returned feature lineage.
- deterministic replay from stored snapshot + schema + transform hashes.
- no unexplained feature value differences across two independent replays.

## Decision

**TEST.** Do not introduce a feature-store dependency into production yet. Implement the contract and fixture first; Feast is a reference implementation, not an adoption decision.

## Risks

- availability timestamps may not exist for all vendors;
- retroactive corrections can make old states difficult to reconstruct;
- session/calendar mistakes can mimic alpha;
- extra provenance may increase storage volume.

## Implementation candidate

Extend `bo.experiment.v1` with a `feature_availability_manifest` reference rather than embedding all observations. The manifest should be immutable/content-addressed and bind each decision-facing feature set to the as-of retrieval policy used in the run.
