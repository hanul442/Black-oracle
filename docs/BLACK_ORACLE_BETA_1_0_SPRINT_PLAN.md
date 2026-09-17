# BLACK ORACLE Beta 1.0 — Sprint Plan

Status: DRAFT EXECUTION PLAN
Date: 2026-09-18
Depends on: BLACK_ORACLE_BETA_1_0_PRD.md

## 1. Execution Principle

Do not rebuild BLACK ORACLE from scratch.

Preserve the validated engine and migrate the product surface in controlled layers.

Order of work:

`Trust / contracts → Report → AutoTrade → Marketplace/Community → monetization polish`

No UI phase may silently change strategy, risk, sizing, Paper execution or qualification semantics.

---

# P0 — FOUNDATION / TRUST

## Sprint B0 — Baseline Freeze & Contract Audit

Goal: establish the exact pre-migration source of truth.

Deliverables:
- inventory active runtime services
- inventory current read models and canonical events
- freeze current Paper qualification cohort identity
- map existing V11 surfaces to Beta 1.0 destinations
- identify legacy UI-only components safe to retire later
- create contract matrix for Report / Strategy / Trade / Evidence / Council
- verify rollback refs

Exit gate:
- no ambiguity about which runtime/contract owns each critical field
- Paper qualification lineage remains untouched

## Sprint B1 — Canonical Product Contracts

Goal: define shared domain contracts before rebuilding screens.

Deliverables:
- canonical `EvidenceObject`
- `Opportunity`
- `Report`
- `ReportVersion`
- `CouncilSession`
- `StructuredDecision`
- `StrategySummary`
- `StrategyValidation`
- `PaperPosition`
- `DecisionTrace`
- `CostRecord`
- versioned API/read-model contracts

Critical rule:
Report and AutoTrade must reference the same `trace_id` / `decision_id` family.

Exit gate:
- schema/contracts compile
- old data can be projected into new contracts without rewriting historical events

## Sprint B2 — Runtime / Data Truth Hardening

Goal: finish P0 trust gaps before product expansion.

Deliverables:
- stale/unavailable/provenance state standardized across KRX/crypto/US data
- asset identity/canonical instrument checks
- Evidence ingest health/read model
- background-job idempotency review
- degraded-state contract reused by new UI
- tests for `DATA_GAP`, `STALE`, `NOT_RUN`, `NOT_LINKED`

Exit gate:
- no new Beta screen fabricates missing data
- failed providers degrade locally rather than crash whole app

---

# P1 — CORE BETA PRODUCT

## Sprint B3 — New Shell: Home / Report / AutoTrade / Community

Goal: establish the new navigation without breaking legacy routes.

Deliverables:
- mobile-first shell
- bottom navigation: Home / Report / AutoTrade / Community
- profile/settings entry
- feature-flagged Beta surface
- legacy V11 remains available as rollback/reference
- document scrolling and mobile interaction regression protection

Exit gate:
- all four top-level sections load on mobile
- legacy UI remains reachable behind controlled flag during migration

## Sprint B4 — Report Discovery

Goal: make investment opportunities understandable before deep analysis.

Deliverables:
- Discover feed
- Search
- Recent Reports
- Watchlist
- Candidate vs Qualified visual distinction
- KRX / US / Crypto filters
- sector/theme filters
- opportunity cards with grade/status
- qualification progress/rejection state

Exit gate:
- every card is backed by real read-model data or explicitly unavailable
- no mock opportunity can appear as production truth

## Sprint B5 — Oracle Report Detail

Goal: create the main paid research experience.

Deliverables:
- Decision Card
- current/entry/stop/targets/expected/horizon/risk
- Why Now
- Bull/Base/Bear scenarios
- report version/update timeline
- Evidence section
- Council summary
- Risk/invalidation
- `Use in AutoTrade`

Exit gate:
- Report v1 cannot be overwritten by updates
- all displayed trade-map values identify their source/version

## Sprint B6 — Visual Analysis Layer

Goal: move from text explanation to inspectable visual reasoning.

Deliverables:
- chart overlays for entry/SL/TP
- support/resistance layer
- trend layer
- volume layer
- supply/demand layer where derivable
- wave layer where derivable
- forecast cone architecture
- click explanation → chart highlight interaction
- layer toggles

Exit gate:
- overlays never imply values unavailable from source data
- chart failure degrades to textual report without breaking page

## Sprint B7 — Council Experience v4 Productization

Goal: expose Council as an interactive decision experience while preserving governance.

Deliverables:
- 5 fixed + 1 dynamic seat presentation
- independent opinion lock state
- debate timeline
- weighted vote
- explicit disagreement
- conditional Risk veto display
- Specialist recommendation card
- Specialist invitation entitlement hook
- Council performance profile read model

Exit gate:
- user-visible Council is derived from persisted session state
- missing Council input shows DATA GAP
- Council cannot gain execution authority through UI work

## Sprint B8 — Report → AutoTrade Bridge

Goal: connect research to strategy execution without breaking lineage.

Deliverables:
- `Use in AutoTrade`
- preserve report/version/evidence/council/decision refs
- choose existing strategy
- create/fork strategy
- show compatibility/conflict state
- route through deterministic Risk before Paper execution

Exit gate:
- every launched Paper run references the initiating decision/report where applicable
- no detached duplicate thesis is generated

---

# P1 — AUTOTRADE CORE

## Sprint B9 — Strategy Rank & Detail

Goal: convert existing Strategy Factory/Vault depth into a user product.

Deliverables:
- Overall/KRX/US/Crypto ranks
- AI/User/Official/Fork filters
- AAA grade display
- scorecard
- OOS / Monte Carlo / hard-gate state
- regime strengths/weaknesses
- lifecycle state
- rank movement

Exit gate:
- ranking is generated from persisted validation records
- grade cannot be inferred from return alone

## Sprint B10 — Strategy Builder

Goal: allow user-created strategies without bypassing validation.

Deliverables:
- Natural Language builder
- normalized Strategy Spec preview
- Visual Builder contracts/UI
- advanced DSL/code path
- validation errors
- save draft
- compare versions

Exit gate:
- natural language never executes directly
- user confirms normalized Strategy Spec before testing

## Sprint B11 — Fork / Modify / Genome

Goal: make strategy evolution a first-class workflow.

Deliverables:
- fork lineage graph
- `Fork Strategy`
- `Ask AI to Modify`
- manual rule edits
- version diff
- origin labels
- inherited source attribution
- forced re-validation after modification

Exit gate:
- fork never inherits parent's validation grade as its own
- lineage survives subsequent forks

## Sprint B12 — Validation Pipeline Productization

Goal: expose existing research gates clearly.

Deliverables:
- Backtest
- Costs/Slippage
- Walk Forward
- OOS
- Monte Carlo
- Regime Stress
- Shadow
- Paper qualification state
- pass/block reasons
- promotion candidate packet

Exit gate:
- hard gate failure visibly blocks promotion
- unavailable metrics are not fabricated

## Sprint B13 — Paper Portfolio & Trade

Goal: make running strategies and positions easy to understand.

Deliverables:
- Paper portfolio value
- daily/total PnL
- risk usage
- active strategies
- positions
- orders
- history
- position card with current/entry/time/SL/TP/expected/PnL
- thesis state
- next reassessment

Exit gate:
- user can inspect a loss without hidden entry/exit details
- candidate trade maps cannot be confused with active-position protection

## Sprint B14 — Decision Replay Integration

Goal: make auditability a visible product advantage.

Deliverables:
- Discovery
- Report
- Council
- Strategy
- Risk
- Order
- Position
- Outcome timeline
- expandable event details
- explicit missing-link states

Exit gate:
- trace is explicit-only; no cross-trace event mixing

---

# P2 — MARKETPLACE / COMMUNITY

## Sprint B15 — Marketplace Beta

Goal: make validated strategy discovery useful without paid sales.

Deliverables:
- Publish
- Discover
- Rank
- Save
- Follow
- Compare
- Paper Run
- Fork
- Modify
- strategy quality/validation visibility

Excluded:
- paid purchase
- revenue share

Exit gate:
- Marketplace cannot imply an unvalidated user strategy is Oracle-approved

## Sprint B16 — Lightweight Community

Goal: create network effects around first-class product objects.

Deliverables:
- Trending Strategies
- Trending Reports
- Experiments
- Fork Activity
- comments
- profiles
- following
- report/strategy discussion
- basic moderation/report controls

Exit gate:
- Community does not become a generic feed detached from Report/Strategy objects

---

# P2 — MONETIZATION / OPERATIONS

## Sprint B17 — Entitlements & Credits

Goal: enforce plan boundaries and high-cost AI usage controls.

Deliverables:
- Oracle / Oracle+ / Pro / Enterprise entitlement model
- Oracle Credits ledger
- Specialist credit use
- Deep Report / Council re-run credit hooks
- plan-restricted states
- credit depleted flow
- limited rollover model

Exit gate:
- entitlement checks are server-enforced, not UI-only

## Sprint B18 — COGS / Cost Ledger

Goal: make pricing measurable.

Deliverables:
- model invocation cost
- report cost
- Council cost
- Specialist cost
- backtest/Monte Carlo compute cost
- storage/data usage cost hooks
- per-user/month summaries

Exit gate:
- Beta can calculate approximate direct variable cost per active user

## Sprint B19 — Product Polish & Accessibility

Goal: refine experience after truth and flows are stable.

Deliverables:
- motion system
- Council vote animations
- specialist join animation
- strategy-rank movement
- report update transitions
- responsive polishing
- reduced-motion support
- loading/empty/error/restricted state audit

Exit gate:
- animation does not block data access, scrolling or interaction

---

# P2 / POST-BETA READINESS

## Sprint B20 — Enterprise Extension Points

Deliverables:
- tenant-aware Evidence contracts
- RBAC model
- connector SDK boundary
- private report/council namespace design
- audit log model

No broad Enterprise UI required.

## Sprint B21 — Live Readiness Architecture

Deliverables:
- broker/exchange adapter boundary
- credentials isolation
- execution authority state machine
- Canary stages
- live/Paper divergence telemetry
- live kill-switch contract

No real-money production authority granted by this sprint.

---

# Priority Summary

## P0 — must happen first

1. Baseline freeze / contract audit
2. Canonical product contracts
3. Runtime + market-data truth hardening

## P1 — Beta 1.0 core

4. New shell
5. Report discovery
6. Oracle Report
7. Visual analysis
8. Council productization
9. Report→AutoTrade bridge
10. Strategy Rank/detail
11. Strategy Builder
12. Fork/Modify
13. Validation pipeline
14. Paper portfolio/trade
15. Decision Replay

## P2 — growth / monetization

16. Marketplace
17. Community
18. Entitlements/Credits
19. Cost accounting
20. polish/accessibility
21. enterprise extension points
22. live-readiness architecture

---

# Hard No-Regression Gates

Every implementation PR touching Beta 1.0 must verify as relevant:

- Paper qualification cohort identity preserved
- deterministic Risk behavior unchanged unless explicitly versioned
- Strategy Router semantics unchanged unless explicitly versioned
- Council execution authority unchanged unless explicitly versioned
- no cross-trace Decision Replay mixing
- missing data not coerced to zero/default truth
- active-position protection not conflated with candidate trade plan
- runtime/provider failure degrades locally
- live authority remains disabled

---

# Recommended First Build Sequence

The next implementation sequence should be:

**B0 → B1 → B2 → B3 → B4 → B5 → B8 → B9 → B13 → B14**

This delivers an end-to-end usable vertical slice before the more expensive Builder, Marketplace and Community work.

Vertical-slice target:

`Discover opportunity → open Report → inspect Evidence/Council/trade map → Use in AutoTrade → choose ranked strategy → Paper run → inspect position → Decision Replay`

Once this vertical slice is reliable, proceed with B6/B7/B10/B11/B12 and then P2 network/monetization work.
