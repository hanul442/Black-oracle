# Canonical Data + Point-in-Time Contract v1

Status: **FOUNDATION IMPLEMENTATION / ADDITIVE**
Architecture source: `BLACK_ORACLE_CANONICAL_FROZEN_V1.md`

## Purpose

This contract makes the Frozen v1 Point-in-Time invariant executable before any database migration.

A historical run may consume only the exact revision that BLACK ORACLE could prove it had observed and ingested by that run's `asOf` cutoff.

## Time semantics

- `eventTime`: domain time the information describes.
- `sourcePublishedAt`: optional upstream publication time.
- `observedAt`: earliest time BLACK ORACLE can prove it observed this exact revision.
- `ingestedAt`: time this exact revision entered the canonical BLACK ORACLE data plane.
- `asOf`: evaluation cutoff supplied by the historical/replay caller.

The knowledge boundary is `max(observedAt, ingestedAt)`.

### Important consequence

`eventTime > asOf` is **not automatically future leakage**.

A scheduled future event can be valid historical knowledge when its schedule was already observed and ingested before the cutoff. The contract therefore gates on knowledge availability, not merely on the date the event will occur.

## Revision semantics

Each PIT-grade record requires:

- `logicalRecordId`
- `revisionId`
- optional `supersedesRevisionId`

`selectRevisionAsOf` excludes revisions learned after the cutoff and deterministically selects the newest eligible revision.

## Legacy Event Ledger compatibility

Existing `black_oracle_events` rows provide:

- `occurredAt`
- `recordedAt`
- event identity / trace / links

They do **not** universally prove:

- `observedAt`
- formal `revisionId`

The compatibility adapter therefore reports `LEGACY_INCOMPLETE` unless those fields were explicitly recorded in the legacy trace.

It must never infer `observedAt = occurredAt` or invent a revision ID merely to make old history appear PIT-grade.

## Safety boundary

This slice:

- adds types and pure functions only;
- adds no database migration;
- changes no scheduler;
- changes no Risk logic;
- changes no PAPER mutation;
- changes no strategy/Champion authority;
- creates no LIVE authority.

## Next Foundation slice

After this contract passes CI:

1. inventory exact existing Evidence/event producers that can emit real `observedAt` and revision identity;
2. introduce additive producer adapters;
3. define immutable Decision Run + Version Registry contracts;
4. only after Supabase data-plane health is restored, design persistence migration.
