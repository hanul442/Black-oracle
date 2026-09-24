> [!IMPORTANT]
> **SUPERSEDED AS TOP-LEVEL ARCHITECTURE — 2026-09-24**
>
> BLACK ORACLE Architecture **FROZEN v1** is now the canonical top-level product/architecture baseline. The BOT/BOR split below remains useful as historical runtime and repository context, but it must not override the six-domain architecture or authorize implementation that conflicts with Frozen v1.
>
> Canonical source: [BLACK_ORACLE_CANONICAL_FROZEN_V1.md](architecture/BLACK_ORACLE_CANONICAL_FROZEN_V1.md)  
> Migration plan: [FROZEN_V1_MIGRATION_PLAN.md](architecture/FROZEN_V1_MIGRATION_PLAN.md)  
> Current-state audit: [CURRENT_STATE_AUDIT_2026-09-24.md](runtime-truth/CURRENT_STATE_AUDIT_2026-09-24.md)

# BLACK ORACLE Alpha Roadmap

Status: **CANONICAL**
Updated: **2026-09-23**
Target: **Alpha v0.1 — 2026-10-20**

This file is the single current Alpha roadmap for the BLACK ORACLE family. Older master plans, sprint roadmaps, architecture drafts, and open stacked PR descriptions are historical evidence unless this file explicitly activates them.

## Current product truth

- **BOT** owns strategy validation/routing, deterministic Risk, PAPER execution, outcomes, Canonical Ledger, and Decision Replay.
- **BOR** owns evidence, research, challenge, report generation, immutable artifacts, and read/publication surfaces.
- BOR may provide BOT only an explicit versioned evidence/read contract. BOR has no BOT database mutation, order, capital, Risk-bypass, or LIVE authority.
- Alpha remains PAPER-only. No unrestricted LIVE trading, automatic Champion promotion, LLM order authority, or risk-limit relaxation is authorized.

## Current runtime truth

- BOT Foundation-remediation base: `d345ef8ccd83dc642f9c82fd51a36f3b7f65be6b`; governance reconciliation merged in PR #240. The deployed web runtime remains the separately attested A18 code baseline `0a9361c05e5ba0212d7d1bceff032e27ac503ad2`; subsequent Foundation/research documentation does not change protected PAPER behavior.
- BOT A18 exact PR head `fd4731384226d62645295420d43262309ee0b5a8` passed Black Oracle CI run `35709996684` and Trading CI run `35709996675`.
- Railway contains four legacy BOT services. Their configured sources and deployed SHAs are recorded in `docs/runtime-truth/FOUNDATION_ATTESTATION_2026-09-22.md`.
- The production Supabase project reports `ACTIVE_HEALTHY` at the management plane. BLACK ORACLE SQL calls now fail with `INVALID_ARGUMENT` while the same connector succeeds against another project, and direct REST/browser probes time out. PAPER scheduler/writer lineage therefore remains **UNKNOWN**, not PASS.
- BOR S25 base: `71a8bf1c5f267497aad32da2a9c6f4029bfcb8e0`; Foundation runtime preparation merged at `8ae39ea4a7e6e556ebc250555fd2f09bdab11cfa`. S26 remains isolated in draft PR #34. Railway rejected the new service at the effective workspace resource ceiling, so no BOR runtime is deployed.

## Active sprint

**Foundation Closure only.**

1. attest A18 exact deployed BOT revision without changing PAPER semantics;
2. prove one scheduler/writer/state lineage for every protected PAPER runtime;
3. establish the approved isolated BOR service and volume, then verify its authority-free durable publish/read boundary;
4. preserve one canonical roadmap and classify legacy work;
5. stop before the final cross-system audit for an Astra verification pass.

## Open item classification

Every item below has exactly one disposition.

### BOT issues

| Item | Disposition | Reason |
| --- | --- | --- |
| #11 Experiment Lab foundation | SUPERSEDED | Experiment/validation contracts now exist on main. |
| #13 Strategy Genome design | SUPERSEDED | Genome/Factory contracts now exist on main. |
| #15 Council scenario cleanup | SUPERSEDED | Later Council and Alpha-shell work replaced this branch plan. |
| #16 v0.3 realignment | SUPERSEDED | Later main-line integration and Alpha contracts replace the stacked architecture. |
| #71 pre-trade Council authority | DEFERRED_POST_ALPHA | Any authority promotion needs separate empirical evidence and approval. |
| #145 trigger-aware fills/outcome attribution | ACTIVE | Relevant to PAPER correctness; do not alter the protected runtime during Foundation Closure. |
| #161 Railway source-pin drift | STALE_RESOLVED | Exact BOT main SHA is deployed and independently attested; issue closed. |
| #165 duplicate PAPER writers | BLOCKER | Supabase scheduler/control-plane lineage is currently inaccessible; status remains UNKNOWN. |
| #204 independent BOR boundary | BLOCKER | Hobby shows 4/5 services in `Black Oracle`, but the workspace already has five services across its two projects and Railway rejects another service. No BOR service was created. |

### BOT pull requests

| Items | Disposition | Reason |
| --- | --- | --- |
| #12, #14, #17, #19, #20, #21, #22, #23, #29, #36 | SUPERSEDED | Historical stacked sprint lines; do not merge into current main. |
| #25, #27, #30, #31, #32, #33, #34, #35, #37, #39, #41, #43 | STALE_RESOLVED | NARS work is retained as evidence and represented by later production-source synchronization; no blind close/delete. |
| #198 LLM strategy research | RESEARCH_ONLY | Evidence for future experiments; no runtime authority. |
| #200 Report-first / Credit Economy | DEFERRED_POST_ALPHA | Monetization/report migration is outside Foundation Closure. |

### BOR pull requests

| Item | Disposition | Reason |
| --- | --- | --- |
| #16 OSIRIS Global Intelligence | KEEP_ISOLATED | Research-only and explicitly outside the current Alpha runtime path. |
| #34 BOR-S26 PDF byte renderer | DEFERRED_FOUNDATION_FREEZE | Keep isolated; S22–S25 are merged, but feature work is frozen until runtime remediation closes. |

## Deferred work

- MA1+ and new product features
- Report-first v3 and Credit Economy
- OSIRIS / Global Intelligence implementation
- major UI redesigns
- unrestricted LIVE trading or new trading authority
- automatic strategy/Champion promotion
- additional paid infrastructure beyond the approved remaining Railway service/volume

## Safety boundaries

- deterministic Risk remains mandatory;
- no broker credential exposure;
- no LLM direct order authority;
- no risk-limit relaxation;
- no rewriting protected PAPER history;
- BOR cannot mutate BOT execution state;
- unavailable/stale evidence fails closed;
- missing information stays explicit.

## Milestone readiness

| Milestone | Readiness | Evidence / gap |
| --- | --- | --- |
| 2026-09-24 Quant Core | **PARTIAL** | Experiment Ledger, Champion–Challenger, Monte Carlo, blind/OOS, walk-forward, Factory/Router, `NO_TRADE`, and attribution contracts/tests exist. Runtime persistence and qualification evidence cannot be verified while Supabase is unavailable. |
| 2026-09-25 Research Core | **PARTIAL** | Provenance, contradiction handling, Council/Red Team, NARS evidence contracts, BOR report/read model, and no-authority boundaries exist. Real production data path and BOR durable runtime storage are not attested. |
| 2026-09-27 PAPER E2E | **BLOCKED** | `src/trading/alphaIntegrationAudit.test.ts` explicitly covers validation -> Champion/Challenger -> governance -> Risk -> PAPER dry run -> outcome lineage. It does not yet prove one runtime trace from real Market/Evidence through actual PAPER mutation, canonical persistence/replay, and BOR report resolution. |

## Next milestones

1. restore read-only Supabase observability and mechanically attest scheduler, writer, last invocation, and canonical checkpoint/event lineage;
2. obtain Railway authority/capacity for one additional workspace service, then deploy the prepared BOR-only service/volume and attest durable persistence;
3. build the 9/27 runtime E2E fixture against isolated PAPER state, including both execution and `NO_TRADE`, then verify ledger/replay/report continuity.
