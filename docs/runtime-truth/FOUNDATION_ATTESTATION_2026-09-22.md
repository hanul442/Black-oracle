# Foundation Runtime Attestation — 2026-09-22

Disposition: **BLOCKED / BOT web revision attested / independent BOT runtime capacity-blocked**

## Repository gate

| Repository | Runtime code baseline | Gate |
| --- | --- | --- |
| `hanul442/black_oracle_bot` | `0a9361c05e5ba0212d7d1bceff032e27ac503ad2` | A18 merged; exact PR head `fd473138...` passed Black Oracle CI and Trading CI. Five-surface truth audit PASS. Later Foundation commits are documentation-only. |
| `hanul442/black_oracle_report` | `9118fe77780b26fe1901dc76bcf0add8231d29e0` | S21 merged. Later Foundation changes add build/test closure but no deployed runtime. |

## Railway BOT runtime matrix

Project: `Black Oracle`, environment: production. Provider UUIDs and deployment UUIDs are intentionally excluded from this public document.

| Service | Purpose / authority | Configured source | Runtime/deployment evidence | Canonical PAPER mutation |
| --- | --- | --- | --- | --- |
| `black-oracle-web` | Web/API gateway; scheduler-authenticated PAPER-cycle route exists | `hanul442/Black-oracle`, `main` | legacy runtime; A18 web deployment was separately attested | Candidate writer when targeted; not proven read-only |
| `black-oracle-paper-vnext` | protected qualification PAPER runtime | `hanul442/Black-oracle`, `main`; service config exposes a historical source commit | one replica; `/health`; qualification variables present | Yes; writer candidate |
| `black-oracle-paper-s2-shadow` | shadow PAPER / KRX research producer | `hanul442/Black-oracle`; branch not explicit | one replica; no Railway cron | Shadow state/event writer candidate |
| `black-oracle-paper-v9-multiasset` | multi-asset PAPER / KRX research producer | `hanul442/Black-oracle`; branch not explicit | one replica; `/health`; no Railway cron | PAPER/event writer candidate |

All existing PAPER services remain legacy `hanul442/Black-oracle` services. None is sourced from the independent `hanul442/black_oracle_bot` repository.

### FOUNDATION-R1 independent BOT runtime provision attempt
A new isolated Railway service named `black-oracle-bot-alpha`, sourced directly from `hanul442/black_oracle_bot` `main`, was requested without broker credentials, scheduler authority, database migration, or changes to any protected PAPER service. Railway rejected provisioning before service creation with **`Free plan resource provision limit exceeded. Please upgrade to provision more resources!`**.

Result: **BLOCKED BY PROVIDER CAPACITY/PLAN**. No new service exists, no deployment occurred, and no legacy runtime was repointed or disabled. This is an infrastructure-capacity blocker, not a repository/build failure. The safe rollback is therefore a no-op.

## Safe A18 deployment

The web-only A18 revision was previously deployed at exact SHA `0a9361c05e5ba0212d7d1bceff032e27ac503ad2`, preserving variables, runtime ID, scheduler, database, replicas, and risk settings. Railway health and public `/health` passed while protected read APIs remained authentication-gated. No PAPER service deployment is authorized merely from that evidence.

## Single-writer PAPER attestation

| Required evidence | Observation | Status |
| --- | --- | --- |
| authoritative runtime ID | legacy services expose overlapping PAPER runtime identity/authority surfaces | BLOCKED |
| scheduler target | Supabase scheduler v18 reads `black_oracle_trading_scheduler_config` at invocation time | PARTIAL: target mechanism proven; enabled row unavailable |
| scheduler allowlist | scheduler v18 hard-allowlists web, vnext, vnext-s1r2 and s2-shadow HTTPS targets; arbitrary target URLs fail closed | PASS as source-contract evidence |
| permitted writer | scheduler requires enabled config + approved target + per-runtime auth token before invoking `/api/trading-paper-cycle` | PARTIAL: contract proven; active row unavailable |
| database control-plane read | direct SQL `select now()` plus scheduler-config read attempt timed out again | BLOCKED |
| canonical checkpoint/event lineage | database read unavailable | UNKNOWN |
| competing candidates | web/vnext/s2 remain approved scheduler targets; V9 remains a separate writer candidate outside the scheduler allowlist | BLOCKED pending control-plane proof |

Disposition: **UNKNOWN / BLOCKED**. Scheduler source substantially narrows the authority surface but does not prove which runtime row is currently enabled, so no single-writer PASS is claimed.

## Supabase observation

- production project `black_oracle` remains `ACTIVE_HEALTHY` at the management plane;
- direct SQL remains unavailable with `Connection terminated due to connection timeout`;
- `black-oracle-paper-scheduler` is ACTIVE version 18 with JWT verification;
- version 18 source was read directly from the deployed Edge Function;
- its `APPROVED_TARGETS` map contains only the web, vnext/vnext-s1r2, and s2-shadow Railway origins;
- it reads scheduler config and scheduler auth from Supabase REST, validates HTTPS + exact approved origin, and fails closed when config/auth/target is missing or invalid;
- V9 is not in the scheduler v18 approved-target map, but may still have independent in-process behavior and therefore cannot be declared non-writer without runtime/database evidence.

No database, cron, Edge Function, checkpoint, ledger, scheduler, broker secret, Risk limit, or qualification-history mutation was performed.

## Foundation blockers carried to final verification

1. Railway resource capacity/plan must permit one isolated `hanul442/black_oracle_bot` service before independent BOT runtime attestation can complete;
2. recover Supabase data-plane access and read the enabled scheduler-config row to prove the exact scheduler target and writer lineage;
3. complete authenticated A18 source-health payload smoke without exposing credentials;
4. preserve deterministic Risk and PAPER lineage while the above remain unresolved.
