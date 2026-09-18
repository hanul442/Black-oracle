# B0 Beta Authority and Namespace Design

**Sprint / work package:** B0 / B0.3  
**Status:** DESIGN ONLY — NOT APPLIED  
**Production mutation:** none

## Decision

Beta server workloads require a dedicated `black_oracle_beta_server` database identity and a separately owned `black_oracle_beta` schema. The operational Supabase `service_role` is explicitly forbidden for beta product adapters because it can mutate protected legacy state and bypass RLS.

This design does not complete B0.3. It creates the reviewable, machine-checked authority contract that a later migration and ephemeral integration test must satisfy before any production DDL is considered.

## Authority model

- The beta server identity is `NOINHERIT`, `NOBYPASSRLS`, non-superuser, and cannot create roles, databases, schemas, or objects.
- A separate owner role owns beta objects. Runtime credentials never own database objects.
- Browser roles have no `USAGE` on the beta schema.
- Beta-owned writes are confined to `black_oracle_beta`; no beta object may own or reference a destructive path into protected legacy stores.
- Legacy reads use an explicit allowlist of `security_invoker` read models. Direct legacy table grants are forbidden.
- Security-definer functions are forbidden by default. A narrowly reviewed exception must pin a safe search path, reject invalid input, avoid dynamic SQL, use an explicit EXECUTE grant, and pass negative authority tests.

## Protected legacy state

Positions, orders, Ledger, checkpoints, strategy identity, and qualification cohorts remain read-only. The beta identity must fail INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, CREATE, ownership changes, and any SET ROLE path to an operational identity.

Report and AutoTrade remain independent products. A Report record or report-generation result cannot grant execution authority, and no beta role can bypass deterministic Risk. All trading remains PAPER ONLY.

## Apply gate

No production DDL is authorized by this document. A later B0.3 implementation PR must include:

1. a reviewed migration with no credential material;
2. an ephemeral database or isolated branch test;
3. successful beta-namespace write tests;
4. successful allowlisted read-model tests;
5. failed mutation tests for every protected legacy class;
6. proof that the runtime role cannot inherit, bypass RLS, own objects, or assume an operational role;
7. a rollback rehearsal that revokes the beta role and drops only beta-owned objects.

## Rollback

This design PR is rolled back by reverting its files. A future applied implementation must be reversible without deleting, rewriting, re-keying, or reseeding any protected legacy data.
