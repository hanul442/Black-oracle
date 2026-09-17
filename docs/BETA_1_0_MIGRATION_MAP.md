# BLACK ORACLE Beta 1.0 Migration Map

Status: MIGRATION SOURCE OF TRUTH
Date: 2026-09-18
Target product surface: **Home / Report / AutoTrade / Community**

## 1. Migration Principle

Beta 1.0 is a product-surface and product-model migration, not a ground-up replacement of the investment engine.

Target rule:

> **Preserve engine truth. Replace product language. Productize validated internal capabilities. Add only the missing commercial/community layers.**

No migration step may silently alter PAPER qualification semantics, deterministic Risk behavior, strategy sizing, Council authority, canonical lineage, or historical outcomes.

---

## 2. Classification Vocabulary

- **KEEP** — retain current concept and implementation contract unless a separate engineering audit finds a defect.
- **KEEP + PRODUCTIZE** — preserve the engine capability but redesign how normal users access and understand it.
- **REFACTOR** — preserve intent but change interfaces, structure, naming, or implementation.
- **MIGRATE** — move data/capability into the Beta 1.0 canonical product model.
- **HIDE INTERNAL** — keep backend capability but remove it from primary navigation/product language.
- **ABSORB** — merge a standalone surface into another user workflow.
- **DEPRECATE UI** — retire user-facing surface after parity and migration checks.
- **ARCHIVE** — preserve history/data/reference without keeping active product surface.
- **NEW** — net-new Beta 1.0 capability.

---

## 3. Existing Capability Mapping

| Existing capability | Disposition | Beta 1.0 destination | Notes |
| --- | --- | --- | --- |
| Canonical Event Ledger | KEEP | Shared infrastructure | Core audit moat; never replace with UI-local state |
| Decision Trace / trace_id | KEEP | Shared infrastructure | Required across Report and AutoTrade |
| Decision Replay | ABSORB | Report History + Trade Detail | Keep engine; remove need for top-level destination |
| Deterministic Risk | KEEP | AutoTrade internal + risk detail | Risk remains sovereign |
| PAPER Runtime | KEEP | AutoTrade / Trade | Preserve qualification sample and runtime history |
| Strategy Factory | KEEP + PRODUCTIZE | AutoTrade / AI Incubator | Existing autonomous research becomes user-facing product |
| Strategy Vault | KEEP + PRODUCTIZE | AutoTrade / Strategies | Rename and simplify |
| Champion–Challenger | KEEP + PRODUCTIZE | Strategy Rank / Arena | User sees competition/ranking, not governance jargon first |
| Monte Carlo | KEEP | Strategy validation detail | Not a top-level menu |
| OOS / Walk-forward validation | KEEP | Strategy validation detail | Hard gate input |
| Grade System | KEEP | Strategy Rank / Reports | Shared trust language |
| Strategy Router | HIDE INTERNAL | AutoTrade engine | Expose selected strategy/conflict rationale only on drill-down |
| Arbiter | HIDE INTERNAL | Decision synthesis | Preserve where useful, avoid user-facing jargon |
| Independent Red Team | HIDE INTERNAL / REFACTOR UX | Council debate/challenge | Productize as structured dissent, not separate navigation |
| Council | KEEP + PRODUCTIZE | Report detail | Interactive vote/debate/specialist experience |
| Dynamic specialists | KEEP + PRODUCTIZE | Report / Specialist Bench | Entitlement/Credit-ready |
| NARS | MIGRATE | Oracle Intelligence | Generalize beyond news; preserve existing producers during migration |
| Evidence projections | KEEP + PRODUCTIZE | Report / Evidence | Expand provenance/contradiction UX |
| Market State / Regime | KEEP + PRODUCTIZE | Home + Report discovery | Explainable user-level summary |
| KRX canonical instrument model | KEEP | Shared market-data layer | Must remain source-of-truth for identity |
| Crypto market path | KEEP | Report + AutoTrade | Preserve existing PAPER infrastructure |
| KRX PAPER path | KEEP | Report + AutoTrade | Preserve existing PAPER infrastructure |
| Markets screen | REFACTOR / ABSORB | Report Discover/Search | Standalone Markets tab no longer required by default |
| Instrument Cockpit | REFACTOR | Report Detail / Trade Detail | Split research vs active-position context without losing lineage |
| Trade screen | REFACTOR | AutoTrade / Trade | Strategy-centric portfolio and position view |
| Lab | KEEP + PRODUCTIZE | AutoTrade / Strategies | Fold into Strategy Rank, Builder, Incubator, Validation |
| System screen | DEPRECATE UI | Admin/operator diagnostics | User sees only material degraded-state warnings |
| Technical logs | DEPRECATE UI for normal users | Admin/operator | Preserve observability |
| Investment logs | ABSORB | Activity + Report/Trade history | Product-language events |
| Cases | ARCHIVE | Internal/history | No top-level Beta surface |
| Hypothesis | ARCHIVE / internal object | Report thesis where useful | No top-level Beta surface |
| Scenario | ABSORB | Report Forecast | Bull/Base/Bear and scenario history |
| Forecast | KEEP + PRODUCTIZE | Report | Immutable versioned forecast |
| Calibration | KEEP | Report/Agent/Strategy track record | Expose only where sample quality is sufficient |
| Firebase-era product paths | DEPRECATE / remove after audit | None | Do not remove data needed for history |
| Legacy mobile V2–V10/V11 surfaces | DEPRECATE after parity | New Beta shell | Retain rollback/reference until parity proven |

---

## 4. Net-New Beta 1.0 Capabilities

### 4.1 Report product layer

NEW:

- Report Discover
- instrument/sector/crypto search
- Recent Reports
- Watchlist Reports
- Qualified Opportunity cards
- visual chart analysis layers
- immutable Report versions
- Report → AutoTrade handoff

### 4.2 Strategy product layer

NEW / PRODUCTIZATION:

- Strategy Rank
- Official / AI / User / Fork origin labels
- strategy comparison
- fork lineage graph
- natural-language strategy builder
- visual builder
- code/DSL editor surface
- AI-assisted modification

### 4.3 Marketplace

Beta 1.0:

- publish
- discover
- rank
- save/follow
- Paper Run
- fork
- modify
- compare

Post-Beta:

- paid strategy transactions
- creator subscriptions
- revenue share
- marketplace fee

### 4.4 Community

Beta 1.0 lightweight scope:

- Trending Strategies
- Trending Reports
- Experiments
- Fork Activity
- Comments
- Creator/Profile pages

Avoid building a generic social network before Report and AutoTrade prove product value.

### 4.5 Commercial infrastructure

NEW:

- subscriptions: Oracle / Oracle+ / Oracle Pro / Oracle Enterprise
- entitlement matrix
- Oracle Credits ledger
- plan-aware Report/Council/Specialist access
- real COGS accounting by user and workload

---

## 5. Target Navigation Mapping

### Old / current operating surfaces

- Command / Home
- Markets
- Oracle
- Trade
- Lab
- System

### Beta 1.0

- **Home**
- **Report**
- **AutoTrade**
- **Community**

Secondary:

- Profile
- Subscription / Credits
- Connections
- Alerts
- Risk preferences
- API
- Security
- Settings

Operator-only:

- System health
- runtime diagnostics
- scheduler
- persistence
- ledger diagnostics
- deep technical logs

---

## 6. Canonical Product Flow

Beta 1.0 must preserve one canonical backend graph:

```text
Oracle Intelligence
        ↓
Discovery
        ↓
Candidate
        ↓
Qualification
        ↓
Report
        ↓
Council / Decision
        ↓
Use in AutoTrade
        ↓
Strategy Router
        ↓
Portfolio Risk
        ↓
Paper Execution
        ↓
Position / Outcome
        ↓
Calibration + Strategy Learning
```

Report and AutoTrade must never create incompatible duplicate truths for the same decision.

---

## 7. Data Migration Rules

### Preserve without reinterpretation

- historical PAPER trades
- positions/outcomes
- existing strategy experiment records
- qualification cohorts
- Evidence records
- Council sessions where canonical
- risk decisions
- orders/fills
- forecast observations
- calibration data
- canonical events

### Version when semantics change

Any material change to:

- strategy eligibility
- sizing
- risk gates
- Council authority
- evidence requirements
- execution behavior

must create a new policy/version boundary rather than silently mixing old and new samples.

---

## 8. UI Migration Rules

1. Build the Beta shell in isolation.
2. Reuse canonical backend/read contracts where they are already truthful.
3. Never fabricate values to satisfy a new card or visual.
4. Preserve explicit `DATA GAP`, `STALE`, `NOT LINKED`, or `NOT RUN` states.
5. Replace top-level engineering terminology with user goals.
6. Important drill-downs use full-screen navigation on mobile where possible.
7. Preserve validated chart interaction and entry/SL/TP truth separation.
8. Retire old surfaces only after parity and trace integrity are proven.

---

## 9. Recommended Migration Sequence

### Phase A — Constitution and contracts

- Product Constitution v2
- Migration Map
- README
- define Beta 1.0 canonical screen/object names
- freeze protected PAPER invariants

### Phase B — Report shell

- Report navigation
- Discover/Search/Recent
- Report Detail
- visual chart layers
- Council embedding
- Evidence embedding
- Report versions

### Phase C — AutoTrade shell

- Strategy Rank
- Strategy Detail
- Builder/Fork/Modify
- Portfolio
- Positions
- Trade Detail / Replay

### Phase D — Strategy productization

- Strategy Factory → AI Incubator
- Champion/Challenger → Rank/Arena
- validation pipeline UI
- fork lineage

### Phase E — Lightweight Marketplace/Community

- publish/save/follow
- Paper Run/Fork
- comments/profiles
- trending feeds

### Phase F — Commercial layer

- plans
- credits
- entitlement checks
- cost ledger

### Phase G — Legacy retirement

- feature-parity audit
- runtime/lineage regression
- remove obsolete navigation
- archive legacy screens
- retain migration documentation

---

## 10. Hard No-Regression Gates

Migration fails if any of the following occurs:

- PAPER qualification history becomes incomparable without an explicit version reset
- candidate levels overwrite active-position protection levels
- missing values become displayed zeros or invented data
- canonical trace purity is lost
- Report and AutoTrade disagree about the identity of the same decision/trade
- Risk authority weakens implicitly
- Community/Marketplace code gains execution authority
- a strategy can bypass validation because it was forked or purchased
- legacy UI is removed before parity/rollback confidence exists

---

## 11. Target Outcome

The final product should be easier to understand than the existing operating console without becoming a simpler engine.

**User-facing simplification is not backend simplification.**

The migration is successful when a normal user can understand BLACK ORACLE as:

> **Report tells me what is interesting and why. AutoTrade lets me build or choose a validated strategy and run it. Community lets research and strategies evolve through other users.**

while an advanced user can still drill down to the complete evidence, strategy, Council, Risk, execution, and outcome lineage behind any material decision.
