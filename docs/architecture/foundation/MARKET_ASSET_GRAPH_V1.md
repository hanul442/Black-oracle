# Market / Asset Graph Foundation v1

Status: **FOUNDATION IMPLEMENTATION / ADDITIVE**

## Purpose

The Frozen v1 graph is a relationship substrate, not a visualization feature.

It preserves auditable paths between:

- Events,
- Companies,
- Sectors,
- Countries,
- Themes,
- Technologies,
- Commodities,
- People,
- Assets,
- broader market/macro entities.

## Point-in-Time graph

Every graph edge is a Canonical Data revision.

That means historical traversal selects only the edge revision BLACK ORACLE could know at the requested `asOf` time.

If a relationship is later corrected or revoked, the correction does not leak backward into old Decision Runs.

## Source-backed edges

A relationship cannot exist without at least one of:

- Evidence lineage,
- canonical source-data lineage.

The graph contract deliberately contains no invented confidence score.

If a relationship is uncertain, use `CONTESTED` rather than manufacturing numeric certainty.

## Impact paths

The Foundation traversal preserves:

- first-order paths,
- second-order paths,
- deeper-order paths up to an explicit bounded depth.

Directed and undirected relationships are distinct and cycle-safe.

This allows future flows such as:

`Event → Commodity → Company → Asset`

without making the UI or Forecast engine part of the graph itself.

## Safety

The graph has no Strategy, Risk, order, execution, or LIVE authority.

This PR does not add a database migration or graph database. Persistence/topology remains a later implementation decision after the contract and Supabase health are verified.

## Next

The independent Foundation contracts are now present.

Next work is an adapter/wiring pass across existing BOT / BOR / NARS code, followed by a Foundation cross-system audit. Stop before that final audit for the requested Astra verification pass.
