# Production Source Truth

This document defines the S0 convergence rule for BLACK ORACLE.

## Canonical rule

Production infrastructure must be represented by reproducible Git source. A merged PR, deployed function, or applied migration is not considered fully accounted for until its source is present on `main` and covered by the production source manifest.

The machine-readable snapshot lives at `ops/production-source-manifest.json`; CI validates source presence with `scripts/verify-production-source-manifest.mjs`.

## Authority classification

- `CANONICAL`: active BLACK ORACLE Paper/runtime source.
- `NARS`: active evidence/intelligence infrastructure. NARS has no order authority.
- `LEGACY_RESEARCH`: deployed historical research tables retained for reproducibility; no production execution authority.
- `LEGACY_SHADOW`: deployed comparison/shadow artifacts retained for reproducibility; not the canonical Railway Paper runtime.

Legacy classification does **not** authorize deletion. Retirement remains explicit and requires dependency/comparator evidence plus a separate decision.

## Runtime boundary

Canonical PAPER runtime: Railway `Black Oracle / black-oracle-web`, runtime id `black-oracle-paper`.

Active vNext qualification runtime: Railway `Black Oracle / black-oracle-paper-vnext`, runtime id `black-oracle-paper-vnext-100m-v03`. This qualification namespace is separate from the canonical `black-oracle-paper` namespace and must not be shared by `black-oracle-web`.

For scheduled PAPER cycles, the scheduler delegated runtime id must equal the worker's configured persistence runtime id. The scheduler also delegates one approved Railway service identity, and the worker must fail closed before lease acquisition when either the runtime id or physical service identity differs. HTTP 409 is not a successful scheduler cycle.

Completed scheduled checkpoints and canonical events must carry the same cycle authority provenance: delegated runtime id, lease owner, Railway service id/name, deployment id, and available Git/replica metadata. This provenance is audit evidence only and does not grant execution authority.

`black-oracle-paper-s2-shadow` remains isolated and has no recurring PAPER-cycle scheduler while lineage review remains unresolved; its scheduler control-plane `enabled` state must therefore remain false.

The Supabase `black-oracle-native-paper-shadow` function and its scheduler are preserved as `LEGACY_SHADOW` source only. Their presence in Git must not be interpreted as production execution authority or a cutover decision.

## S0 exit gate

S0 is complete only when:

1. every Production Supabase migration version in the manifest has one Git source file;
2. every deployed Edge Function in the manifest has a Git entrypoint;
3. provisional migration filenames that do not match Production history are removed;
4. NARS CI and BLACK ORACLE CI remain green;
5. no database, scheduler, risk limit, execution authority, or NARS legacy-retirement state is changed merely to achieve source parity.
