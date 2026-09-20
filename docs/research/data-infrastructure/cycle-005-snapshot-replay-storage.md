# Cycle 005 — Snapshot-addressable research data

Date: 2026-09-20
Research ID: DI-004
Status: TEST / REFERENCE
Experiment: EXP-DI004
Production impact: None

## Research question
Should BLACK ORACLE's reproducibility substrate preserve immutable/snapshot-addressable table state in addition to logical dataset hashes and point-in-time feature metadata?

## Source and evidence
DuckDB's official Iceberg integration supports querying an attached Iceberg table by snapshot ID or timestamp (`AT (VERSION => ...)` / `AT (TIMESTAMP => ...)`). DuckDB's lakehouse documentation also describes open table formats as maintaining transaction guarantees and snapshot history. Evidence grade: A- infrastructure precedent from official documentation; this is not evidence that Iceberg is necessarily the right production storage layer for BO.

## Relevance
Cycle 003/004 established `bo.experiment.v1` and point-in-time feature semantics. Those contracts can identify a dataset logically, but replay is stronger when the underlying table state can also be addressed by an immutable snapshot/version.

## Gap
A hash proves identity only if the exact bytes/state are retained and retrievable. Mutable source tables or vendor corrections can make an old experiment impossible to reconstruct even when its metadata is perfect.

## Hypothesis
Binding experiment manifests to a retrievable snapshot ID (or immutable object manifest) will materially increase replay success and make upstream corrections auditable versus retaining only source URI + query + logical hash.

## EXP-DI004
Prototype on a small research dataset, not the production market-data path.

Compare:
A. mutable table + query/hash metadata
B. snapshot-addressable table/object manifest + same metadata

Perform a source correction after the initial experiment and attempt blind replay of both versions.

### Success metrics
- exact row-set reconstruction
- feature/output hash reproduction
- time to replay
- storage overhead
- correction lineage visibility
- portability from local development to Railway/cloud execution

## Proposed integration
Add optional `data_snapshot` fields to `bo.experiment.v1`:
- storage_format
- snapshot_id / immutable manifest ID
- catalog/table identity
- snapshot timestamp
- source revision metadata

Keep this interface storage-neutral. Iceberg/DuckDB is a reference implementation, not a mandatory dependency.

## Important implementation note
DuckDB documents a precision caveat: external nanosecond timestamps with timezone semantics may be converted to microsecond `TIMESTAMPTZ`. BO should therefore validate timestamp precision before using this stack for tick/order-book lineage.

## Risks
- Operational complexity may outweigh benefits at current scale.
- Snapshot retention can increase storage costs.
- Vendor data licensing may constrain raw snapshot retention.
- Snapshot identity does not replace knowledge/availability-time semantics from DI-003.

## Decision
TEST / REFERENCE. Preserve a storage-neutral snapshot field now; decide on Iceberg/DuckDB only after the replay fixture demonstrates value.

## References
- DuckDB Iceberg extension documentation.
- DuckDB lakehouse formats documentation.
- DuckDB timestamp type documentation.
