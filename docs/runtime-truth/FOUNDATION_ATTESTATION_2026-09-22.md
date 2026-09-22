# Foundation Runtime Attestation — 2026-09-22

Disposition: **BLOCKED / evidence captured**

## Repository gate

| Repository | Main SHA | Gate |
| --- | --- | --- |
| `hanul442/black_oracle_bot` | `0a9361c05e5ba0212d7d1bceff032e27ac503ad2` | A18 merged; exact PR head `fd473138...` passed Black Oracle CI `35709996684` and Trading CI `35709996675`. Five-surface truth audit PASS. |
| `hanul442/black_oracle_report` | `9118fe77780b26fe1901dc76bcf0add8231d29e0` | S21 merged. Independent runtime closure handled in BOR repository. |

## Railway BOT runtime matrix

Project: `Black Oracle`, environment: production. Provider UUIDs and deployment UUIDs are intentionally excluded from this public document.

| Service | Purpose / authority | Configured source | Actual deployed SHA before closure | Runtime/deployment evidence | Canonical PAPER mutation |
| --- | --- | --- | --- | --- | --- |
| `black-oracle-web` | Web/API gateway; scheduler-authenticated PAPER-cycle route exists | `hanul442/Black-oracle`, `main` | `d2b6d8626b1d34d5381c38dac49153354e4b2e7f` | startup showed qualification runtime profile | Candidate writer when targeted; not proven read-only |
| `black-oracle-paper-vnext` | protected qualification PAPER runtime | repo `hanul442/Black-oracle`, branch `main`, configured historical pin | `8933516036f0910634fd53e97df1e81cc54637ea` | recent cycles failed checkpoint persistence | Yes; observed cycle invocations, but latest valid write unknown |
| `black-oracle-paper-s2-shadow` | shadow PAPER / KRX research producer | repo `hanul442/Black-oracle`; branch not explicit | `8c2f27aa53345a9738847e05f204cd38cf393d02` | repeated canonical event append timeout/522 | Shadow state/event writer candidate |
| `black-oracle-paper-v9-multiasset` | multi-asset PAPER / KRX research producer | repo `hanul442/Black-oracle`; branch not explicit | `8c2f27aa53345a9738847e05f204cd38cf393d02` | repeated canonical event append timeout/522 | PAPER/event writer candidate |

All four services report one Railway replica and no Railway cron schedule. Supabase is the documented scheduler/control plane; S2/V9 also run in-process KRX research scheduling. `SUCCESS` is not treated as revision or lineage proof.

## Safe A18 deployment

The web-only A18 revision was requested at exact SHA `0a9361c05e5ba0212d7d1bceff032e27ac503ad2`, preserving variables, runtime ID, scheduler, database, replicas, and risk settings. The provider-side deployment and rollback identifiers are retained outside this public repository.

Acceptance requires Railway metadata to report that exact SHA and read-only endpoint smoke tests to pass. No PAPER service deployment is authorized because changing a protected qualification runtime could contaminate evidence.

## Single-writer PAPER attestation

| Required evidence | Observation | Status |
| --- | --- | --- |
| authoritative runtime ID | web and vnext startup/cycle logs both identify `black-oracle-paper-vnext-100m-v03` | BLOCKED: duplicate candidate identity |
| scheduler target | expected in `black_oracle_trading_scheduler_config` | UNKNOWN: direct SQL timed out twice |
| permitted writer | vnext shows real cycle invocations; web exposes the same authenticated mutation route | UNKNOWN |
| deployed revision | captured above | PASS as observation, not freshness |
| last valid invocation | vnext recent invocations returned HTTP 500 during checkpoint persistence | BLOCKED |
| canonical checkpoint/event lineage | database read unavailable; S2/V9 event appends repeatedly return 522/timeouts | UNKNOWN |
| competing candidates | web, vnext, S2, V9 plus preserved legacy Edge Function source | BLOCKED pending control-plane proof |

Disposition: **UNKNOWN / BLOCKED**. No issue may be closed and no single-writer PASS may be claimed from current evidence.

## Supabase observation

- production project management state: `ACTIVE_HEALTHY`;
- `list_tables` and `select now()` both failed with connection timeout;
- migration/advisor reads also timed out;
- Edge Function management API remained reachable;
- `black-oracle-paper-scheduler` is ACTIVE version 18 with JWT verification;
- production source manifest is stale for that function (records version 14), so docs/source parity needs a later verified reconciliation.

No database, cron, Edge Function, checkpoint, ledger, or scheduler mutation was performed.

## Foundation blockers carried to final verification

1. recover Supabase data-plane access and prove the exact scheduler target and writer lineage;
2. attest the A18 web deployment exact SHA and smoke its read-only endpoints;
3. establish independent BOR runtime plus durable BOR-owned artifact persistence;
4. post the final closeout only after the above evidence is available.
