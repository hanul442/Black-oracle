# BOT Runtime / Database Boundary v1

Status: **ALPHA CONTRACT — NOT YET PROVISIONED**

## Ownership

BLACK ORACLE BOT owns its runtime, operational database, trading event lineage, strategy validation records and broker adapter boundary. BLACK ORACLE REPORT owns none of these resources and receives no implicit database access.

The machine-readable contract is `src/trading/runtimeOwnership.ts` (`bot.runtime-ownership.v1`). Infrastructure provisioning must satisfy that contract before it can become an Alpha runtime.

## Runtime boundary

Allowed Alpha authority ceiling:

`PAPER → LIVE_SHADOW → LIVE_CANARY_READINESS`

`LIVE_CANARY_READINESS` means qualification/readiness evidence only. It does not authorize unrestricted LIVE trading.

Deterministic Risk remains mandatory for every execution-capable path. AI agents, Council, Red Team, Router and frontend code cannot override it.

## Database boundary

The independent BOT database may own:
- market/universe snapshots and scanner lineage,
- strategy/version/experiment manifests,
- validation evidence,
- decisions and NO_TRADE records,
- deterministic risk decisions,
- PAPER/LIVE_SHADOW orders, fills, positions and reconciliation,
- canonical event ledger, outcomes and Decision Replay material.

It must not use the BOR database as an operational dependency or shared mutable store. Cross-product exchange, if introduced, must use explicit versioned contracts.

## Legacy PAPER migration rule

Existing legacy PAPER data is **READ_ONLY_MIGRATION_EVIDENCE**. S2 does not copy, rewrite, truncate or delete it. A later migration must preserve source identity, observation timestamps and lineage, and must prove rollback before any cutover.

## Secret boundary

Broker/private exchange credentials are server-only. They must never be serialized into frontend bundles, agent prompts, Council context, research packets or logs. Public market collectors do not require broker secrets.

## Provisioning gate

Before binding Railway/Supabase (or another provider), verify:
1. runtime and database are BOT-owned and independently addressable;
2. BOR has no implicit mutable DB access;
3. legacy PAPER remains untouched/read-only;
4. unrestricted LIVE is disabled;
5. deterministic Risk is required;
6. secret injection is server-only;
7. backup/restore and rollback procedure is documented;
8. smoke verification can run without placing a real order.

## Rollback

Until infrastructure is provisioned, rollback is a repository revert. After provisioning, rollback must first disable BOT schedulers/workers, preserve the append-only/event evidence, restore the prior known-good BOT runtime/config, and never mutate the legacy PAPER source as part of rollback.
