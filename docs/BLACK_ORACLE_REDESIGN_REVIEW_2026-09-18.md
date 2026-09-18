# BLACK ORACLE Redesign Review Packet

Date: 2026-09-18
Purpose: owner review before implementation S0-S14

## 1. Executive Summary

BLACK ORACLE has enough engine components that the main risk is no longer lack of features. The current risk is **architecture drift**: multiple generations of UI, stacked historical PRs, partially overlapping runtime services, and product concepts that no longer describe the intended customer experience.

The redesign therefore makes three decisions:

1. rebuild the product around a global **AutoTrade | Report** split,
2. preserve valuable PAPER/audit/validation data while allowing obsolete code and UI to be replaced,
3. execute through a **Master Plan PR + Sprint PRs**, with 4-6 focused sessions per Sprint and explicit acceptance gates.

## 2. Current-State Snapshot

### GitHub

Observed baseline on 2026-09-18:

- repository: `hanul442/Black-oracle`
- default branch: `main`
- observed latest main commit during planning: `32d3b67e698b13e08549e099bf4ae1c82c0e5394`
- repository already contains a strong engine-oriented Product Constitution and Master Plan v2
- README previously described a coherent investment operating system but not the new AutoTrade/Report product split
- several older stacked draft PRs remain open and should be treated as implementation inventory, not automatic merge candidates

### Railway

Project: `Black Oracle`

Observed production services:

- `black-oracle-web`
- `black-oracle-paper-vnext`
- `black-oracle-paper-s2-shadow`
- `black-oracle-paper-v9-multiasset`

All four reported successful latest deployments at the time of this planning audit, but they were not all deployed from the same commit lineage. S0 must explicitly document the authority and purpose of each service before the redesign changes runtime behavior.

## 3. Product Redesign

### AutoTrade

AutoTrade becomes the main autonomous-investment product.

The system should map investor intent into an explicit strategy/risk package and then route decisions through:

`Market/Evidence -> Strategy Factory -> Router -> Council -> Red Team -> Arbiter -> Risk -> PAPER Execution -> Outcome -> Replay`

The user should always be able to see:

- what AutoTrade is doing,
- what it is allowed to do,
- which strategy is active,
- why a decision occurred,
- current entry/mark/SL/TP and exposure,
- what data is stale or unavailable.

### Report

Report becomes a complete independent research product.

Report should support:

- asset/company/market research,
- source-backed Evidence,
- versioned reports,
- archive and comparison,
- export/share-ready structure.

AutoTrade may link to a Report as supporting context, but Report is not a mandatory execution dependency.

## 4. Preserve vs Replace

### Preserve

- PAPER orders/fills/trades/outcomes
- canonical event lineage
- strategy experiments and versions
- qualification cohorts
- Evidence provenance
- Council/Arbiter records where available
- Monte Carlo / validation outputs
- runtime incidents
- calibration observations

### Replace or retire after review

- obsolete mobile navigation
- duplicate dashboards
- top-level Cases/Hypothesis/Scenario product concepts
- duplicate Log/Ledger surfaces
- stale demo content
- obsolete Firebase-era product assumptions
- abandoned stacked implementations that conflict with current main
- bottom-sheet-heavy deep-analysis flows

## 5. Master Sprint Program

1. S0 - System Audit & Reset
2. S1 - Canonical Data Foundation
3. S2 - New Mobile App Shell
4. S3 - Markets & Evidence
5. S4 - AutoTrade Core
6. S5 - Strategy Factory & Router
7. S6 - Council & Arbiter
8. S7 - Risk & Execution
9. S8 - Trade, Portfolio & Decision Replay
10. S9 - Report Product
11. S10 - Investor Profile & Personalization
12. S11 - Lab & Validation
13. S12 - Pricing, Credits & Entitlements
14. S13 - Realtime, PWA & Notifications
15. S14 - Production Hardening

See `BLACK_ORACLE_MASTER_PLAN_V3.md` for session-level scope and acceptance gates.

## 6. First Execution Gate: S0

S0 should not redesign trading semantics. It should establish a safe baseline.

Required outputs:

- repository/branch/PR inventory,
- Railway service authority map,
- data preservation inventory,
- UI/API legacy matrix,
- current test/build baseline,
- KEEP / MIGRATE / ABSORB / RETIRE / DELETE-LATER decisions,
- prioritized S1/S2 backlog.

## 7. Key Risks

### Risk A - destructive cleanup

Aggressive redesign can accidentally destroy qualification history or remove a still-used data path.

Mitigation: protected-data inventory + parity gate before deletion.

### Risk B - merging historical architecture

Old stacked PRs may contain useful features but can also reintroduce superseded assumptions.

Mitigation: cherry-pick or reimplement useful deltas instead of blindly merging stacks.

### Risk C - UI outruns runtime truth

A polished redesign can create another layer that looks complete while contracts remain fragmented.

Mitigation: every critical UI state must be bound to real read models with explicit degraded states.

### Risk D - engine complexity becomes invisible

Excessive simplification can hide Strategy/Council/Risk behavior.

Mitigation: simple overview + full-page trace/replay drill-down.

### Risk E - Report and AutoTrade recouple

If Report becomes a hidden prerequisite for trading, the product split fails.

Mitigation: separate domain contracts and explicit optional reference links only.

## 8. Owner Review Checklist

Approve/revise the following before S0 exits:

- [ ] AutoTrade and Report remain independent product modes
- [ ] valuable historical/validation data is protected
- [ ] old UI and orchestration may be replaced
- [ ] old stacked PRs are not automatically merged
- [ ] mobile-first remains the primary product target
- [ ] Council remains shadow until validated
- [ ] deterministic Risk remains sovereign
- [ ] PAPER remains the execution authority during this redesign
- [ ] Master Plan v3 becomes the planning source of truth
- [ ] Sprint completion requires tests + runtime contracts + mobile QA + deployment/preview verification

## 9. Recommended Decision

Proceed with the new Master Plan, merge the planning PR after owner review, then execute S0 before any large-scale feature implementation.

The highest-value near-term result is not another screen. It is a **clean, verified system boundary** that lets the redesign proceed without losing historical truth or reintroducing legacy architecture.
