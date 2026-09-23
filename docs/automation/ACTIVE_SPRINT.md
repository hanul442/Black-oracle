# ACTIVE SPRINT — Foundation Remediation

Date: **2026-09-23**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **FEATURE FREEZE / PAPER SINGLE-WRITER BLOCKED**

## Repository and deployment truth

- Current BOT main: `d345ef8ccd83dc642f9c82fd51a36f3b7f65be6b`.
- Deployed web runtime: A18 code baseline `0a9361c05e5ba0212d7d1bceff032e27ac503ad2`.
- Commits after the A18 deployment through current main are Foundation/research documentation and do not change protected PAPER behavior.
- Current BOR main: `71a8bf1c5f267497aad32da2a9c6f4029bfcb8e0`; S22–S25 are merged at repository/local-artifact scope. S26 remains isolated in PR #34.
- Railway is Hobby with 2/2 projects and 4/5 services in the `Black Oracle` project before BOR provisioning. The final service slot is approved for BOR, not a second BOT runtime.

## Freeze

No strategy, Risk, cohort, scheduler-target, LIVE, UI, monetization, S26, or research-feature work advances during remediation. Existing feature and research PRs retain their roadmap classifications and do not merge merely because CI is green.

## Supabase recovery objective

Read-only evidence required for single-writer closure:

1. enabled `black_oracle_trading_scheduler_config` row and exact target;
2. active `pg_cron` job and recent `cron.job_run_details`;
3. latest successful scheduler invocation;
4. current `black_oracle_trading_cycle_leases` state;
5. latest runtime checkpoint metadata by runtime ID;
6. producer/runtime/source-tagged canonical event lineage.

## Current observation

- Supabase management plane: `ACTIVE_HEALTHY`.
- `black-oracle-paper-scheduler`: ACTIVE version 18, JWT required, exact approved-target enforcement in source.
- `black-oracle-runtime-status`: ACTIVE version 4, public read-only status contract.
- BLACK ORACLE `execute_sql` returns `INVALID_ARGUMENT`; direct REST, shell, and cloud-browser requests time out.
- The same Supabase connector successfully executes SQL against another active project, so this is project/data-plane specific.
- Railway can inspect service config/files but cannot execute in the running container or reveal OAuth-hidden variables.
- Enabled scheduler row, cron job, last success, lease, checkpoint, and canonical producer lineage therefore remain unreadable.

## Safety decision

Single writer is **UNKNOWN/BLOCKED**. No scheduler target, cadence, runtime ID, service variable, checkpoint, event, qualification cohort, strategy, or Risk setting is changed without evidence. No writer conflict has been proven, so no writer remediation is authorized.

The next infrastructure action that could restore database observability is a Supabase project fast reboot or provider support intervention. It requires explicit owner authority because it may interrupt production PAPER state. After recovery, repeat the six read-only checks before considering any writer change.

## BOR runtime objective

Use the approved final Railway service slot for one BOR-only service and mounted volume. It must use only `hanul442/black_oracle_report`, carry no BOT/PAPER/trading credentials, keep all authority flags false, and verify durable publish -> resolver -> read behavior. Protected existing services and domains are immutable.

## Exit gate

- Supabase read-only evidence either proves one writer or records the precise owner action still required;
- BOR service exact revision, health, authority flags, durable fingerprint, and read API are attested;
- governance reflects current SHAs and S22–S26 truth;
- repository tests and exact-head CI are green;
- Slack and blocker issues are updated with no unsupported PASS claim.
