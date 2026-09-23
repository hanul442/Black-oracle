# Foundation Runtime Attestation — 2026-09-22

Disposition: **REMEDIATION ACTIVE / BOT web revision attested / PAPER single-writer unknown**

## Repository gate

| Repository | Runtime code baseline | Gate |
| --- | --- | --- |
| `hanul442/black_oracle_bot` | `0a9361c05e5ba0212d7d1bceff032e27ac503ad2` | A18 merged; exact PR head `fd473138...` passed Black Oracle CI and Trading CI. Five-surface truth audit PASS. Later Foundation commits are documentation-only. |
| `hanul442/black_oracle_report` | `71a8bf1c5f267497aad32da2a9c6f4029bfcb8e0` | S22–S25 merged at repository/local-artifact scope. S26 remains isolated in PR #34. Runtime and durable storage require deployment attestation. |

## Railway BOT runtime matrix

Project: `Black Oracle`, environment: production. Provider UUIDs and deployment UUIDs are intentionally excluded from this public document.

| Service | Purpose / authority | Configured source | Runtime/deployment evidence | Canonical PAPER mutation |
| --- | --- | --- | --- | --- |
| `black-oracle-web` | Web/API gateway; scheduler-authenticated PAPER-cycle route exists | `hanul442/Black-oracle`, `main` | legacy runtime; A18 web deployment was separately attested | Candidate writer when targeted; not proven read-only |
| `black-oracle-paper-vnext` | protected qualification PAPER runtime | `hanul442/Black-oracle`, `main`; service config exposes a historical source commit | one replica; `/health`; qualification variables present | Yes; writer candidate |
| `black-oracle-paper-s2-shadow` | shadow PAPER / KRX research producer | `hanul442/Black-oracle`; branch not explicit | one replica; no Railway cron | Shadow state/event writer candidate |
| `black-oracle-paper-v9-multiasset` | multi-asset PAPER / KRX research producer | `hanul442/Black-oracle`; branch not explicit | one replica; `/health`; no Railway cron | PAPER/event writer candidate |

All existing PAPER services remain legacy `hanul442/Black-oracle` services. None is sourced from the independent `hanul442/black_oracle_bot` repository.

### Corrected Railway capacity truth

The workspace is on the **Hobby** plan, not Free. Both project slots are used. Before remediation the `Black Oracle` project contains four of five allowed services and the workspace reports zero of three available volumes in use. The user approved reserving the final service slot for an isolated BOR service with BOR-only variables and storage. The prior provider error text is retained only as historical attempt evidence and must not be used to infer the current plan.

## Safe A18 deployment

The web-only A18 revision was previously deployed at exact SHA `0a9361c05e5ba0212d7d1bceff032e27ac503ad2`, preserving variables, runtime ID, scheduler, database, replicas, and risk settings. Railway health and public `/health` passed while protected read APIs remained authentication-gated. No PAPER service deployment is authorized merely from that evidence.

## Single-writer PAPER attestation

| Required evidence | Observation | Status |
| --- | --- | --- |
| authoritative runtime ID | legacy services expose overlapping PAPER runtime identity/authority surfaces | BLOCKED |
| scheduler target | Supabase scheduler v18 reads `black_oracle_trading_scheduler_config` at invocation time | PARTIAL: target mechanism proven; enabled row unavailable |
| scheduler allowlist | scheduler v18 hard-allowlists web, vnext, vnext-s1r2 and s2-shadow HTTPS targets; arbitrary target URLs fail closed | PASS as source-contract evidence |
| permitted writer | scheduler requires enabled config + approved target + per-runtime auth token before invoking `/api/trading-paper-cycle` | PARTIAL: contract proven; active row unavailable |
| database control-plane read | BLACK ORACLE `execute_sql` returns `INVALID_ARGUMENT`; REST, shell, and cloud-browser probes time out, while another Supabase project accepts `select 1` | BLOCKED / PROJECT-SPECIFIC |
| canonical checkpoint/event lineage | database read unavailable | UNKNOWN |
| competing candidates | web/vnext/s2 remain approved scheduler targets; V9 remains a separate writer candidate outside the scheduler allowlist | BLOCKED pending control-plane proof |

Disposition: **UNKNOWN / BLOCKED**. Scheduler source substantially narrows the authority surface but does not prove which runtime row is currently enabled, so no single-writer PASS is claimed.

## Supabase observation

- production project `black_oracle` remains `ACTIVE_HEALTHY` at the management plane;
- direct SQL remains unavailable: current connector attempts return `INVALID_ARGUMENT`, and data-plane HTTP probes time out;
- the same connector successfully executed `select 1` against another active project, narrowing the failure to the BLACK ORACLE project/data plane rather than a global tool outage;
- `black-oracle-paper-scheduler` is ACTIVE version 18 with JWT verification;
- version 18 source was read directly from the deployed Edge Function;
- its `APPROVED_TARGETS` map contains only the web, vnext/vnext-s1r2, and s2-shadow Railway origins;
- it reads scheduler config and scheduler auth from Supabase REST, validates HTTPS + exact approved origin, and fails closed when config/auth/target is missing or invalid;
- V9 is not in the scheduler v18 approved-target map, but may still have independent in-process behavior and therefore cannot be declared non-writer without runtime/database evidence.

No database, cron, Edge Function, checkpoint, ledger, scheduler, broker secret, Risk limit, or qualification-history mutation was performed.

## Foundation blockers carried to final verification

1. recover BLACK ORACLE Supabase data-plane access and read the enabled scheduler row, active cron, last successful invocation, lease, checkpoint, and producer-tagged events;
2. deploy the approved isolated BOR service/volume and verify publish -> resolver -> read durability without BOT credentials;
3. preserve deterministic Risk, scheduler targets, protected PAPER history, and qualification cohorts while the above remain unresolved;
4. a Supabase project fast reboot or support intervention requires explicit owner authority because it may interrupt production PAPER state.
