# BLACK ORACLE Web Revision Truth — 2026-09-15

## Purpose

P0 runtime-truth release marker for the Consolidation & UX Recovery Sprint.

This commit intentionally changes no application, trading, strategy, risk, Council, persistence, portfolio, database, or execution semantics. Its only purpose is to create a fresh current-main GitHub revision so the Railway `black-oracle-web` source integration can be observed against an exact revision after PR #159 merged.

## Pre-trigger truth

- GitHub `main`: `29b6648b7f228eb3717ea298debed2478e1b5df7`
- `black-oracle-web` latest successful deployment: `1b600e9a188da465f7e9cc6595c6f1a92d1837f8`
- `black-oracle-paper-s2-shadow`: `8c2f27aa53345a9738847e05f204cd38cf393d02`
- `black-oracle-paper-v9-multiasset`: `8c2f27aa53345a9738847e05f204cd38cf393d02`
- `black-oracle-paper-vnext`: `8933516036f0910634fd53e97df1e81cc54637ea`; qualification source contract remains isolated from main and must not be reconciled automatically.

## Release acceptance rule

A Railway deployment is not accepted as current merely because its status is `SUCCESS`. The Web release is accepted only when the deployment metadata commit hash exactly matches the merged GitHub main revision and the affected read-only decision-lineage endpoint passes a production smoke check.

## Protected invariants

- no S1R2 qualification runtime/sample changes
- no real-money authority changes
- no Risk/Router/Council/Execution hard-gate changes
- no canonical ledger semantic rewrite
- no database migration
- no portfolio or account mutation
- no fabricated market/evidence/lineage data
