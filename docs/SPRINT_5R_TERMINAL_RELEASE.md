# BLACK ORACLE — Sprint 5R Terminal Release Contract

Status: **DRAFT / PAPER ONLY**  
Parent: `sprint/5-evidence-governed-validation-closure`  
Release goal: **Evidence-governed Crypto PAPER E2E v1 with a log-first operator terminal**

## 1. Sprint objective

Sprint 5R is not a cosmetic redesign. It closes the gap between the trading system that makes decisions and the interface used to supervise those decisions.

The operator must be able to reconstruct this chain from persisted state:

`Market → Technical Candidate → Evidence → Scenario → Council → Risk → PAPER Decision → Execution/NO_TRADE → Outcome → Validation → Grade`

A new PAPER entry must never be presented as valid merely because technical signals are strong. Evidence, governance and deterministic risk remain separate gates. Protective exits remain deterministic and available even when Evidence or Council state degrades.

## 2. Product identity

BLACK ORACLE is operated as an **investment research, trading validation and supervision OS**, not as a generic AI dashboard.

Primary operator information architecture:

1. `MON` — Monitor
2. `POS` — Positions
3. `AUD` — Audit
4. `LAB` — Validation / Research

Legacy orbital, spatial and conversational surfaces are not primary operator navigation. They may survive only as advanced research visualizations when they expose real persisted relationships.

## 3. Interface contract

### Monitor

Purpose: answer, within seconds, “What is the system doing, what changed, what is at risk, and why?”

Required surfaces:
- PAPER/system state
- cycle number and freshness
- active Evidence count
- audit completeness
- validation state
- equity / cash / P&L / drawdown / open positions
- equity curve
- risk/validation matrix
- chronological decision/event log

### Positions

Purpose: inspect one market/position without leaving its trading context.

Required tabs:
- Overview
- Evidence
- Scenario
- Council
- Risk
- History

Forecast, Council and Evidence are therefore contextual inspection layers, not independent top-level products.

### Audit

Purpose: make every retained decision reconstructable.

Required trace dimensions:
- market context
- technical trace
- risk gate
- Evidence
- forecast/scenario
- Council
- execution trace
- outcome

Missing provenance is shown as `MISSING`, `NOT LINKED`, `UNAVAILABLE` or equivalent. It is never synthesized for presentation.

### Lab

Purpose: separate research/validation from execution authority.

Required surfaces:
- historical blind/no-lookahead validation
- walk-forward folds
- Monte Carlo stress
- integrity coverage/incidents
- promotion gates
- Evidence coverage
- audit quality
- deployment/readiness preflight
- scheduler policy
- PAPER readiness grade

## 4. UI Truth Contract

Every operator value must resolve to persisted or reproducibly derived state.

Allowed path:

`Persisted runtime / ledger / event → API contract → view model → terminal UI`

Forbidden path:

`UI convenience → invented confidence / invented probability / synthetic execution state`

When data does not exist, display unavailability explicitly.

## 5. PAPER execution authority

### New entries

Candidate ENTER is preserved only when:
1. market/technical candidate exists,
2. structured external Evidence is fresh and sufficient,
3. Scenario set is persisted,
4. Council/governance does not oppose the candidate,
5. deterministic Risk approves,
6. portfolio/correlation/capacity gates pass.

Otherwise the result is auditable `NO_TRADE`.

### Existing positions

Protective exits do **not** depend on Evidence availability.

Stop-loss, take-profit and other deterministic protective exits retain authority if Evidence refresh fails, becomes stale or governance degrades.

## 6. Council policy

Current production candidate remains deterministic and auditable. Council output has `executionAuthority=false`.

Target Council v2 architecture:
- independent Market State lens
- independent Evidence/Event lens
- independent Liquidity/Regime lens
- independent Risk/Execution lens
- explicit Falsifier / challenge pass
- Synthesizer preserving dissent and uncertainty
- deterministic Policy Arbiter

The Policy Arbiter is code, not an LLM. No Council agent can directly authorize an exchange order.

## 7. Black Oracle Grade Engine v0.2

Canonical notation explicitly preserves plus / zero / minus across every family:

`AAA+ / AAA0 / AAA- / AA+ / AA0 / AA- / A+ / A0 / A- / BBB+ / BBB0 / BBB- / BB+ / BB0 / BB- / B+ / B0 / B- / CCC+ / CCC0 / CCC- / CC+ / CC0 / CC- / C+ / C0 / C- / D+ / D0 / D- / F+ / F0 / F-`

Grades are never assigned by intuition. The engine first calculates a weighted 0–100 composite and confidence/coverage, then translates the result to a grade. Hard gates cap the maximum allowed grade.

The first operational rating is **PAPER Readiness**, derived from:
- Evidence coverage
- Audit completeness
- historical/OOS validation
- walk-forward validation
- Monte Carlo stress
- integrity coverage
- sample depth
- runtime health

Current numerical rating bands and gate thresholds are versioned governance defaults, not universal statistical claims. They must later be recalibrated from BLACK ORACLE's own validated experiment distribution.

A grade never grants execution authority.

## 8. Infrastructure boundary

Current preferred topology:

- GitHub: source control, CI, heavy research/validation jobs
- Vercel: web/operator UI and API façade
- Supabase Postgres: persistent PAPER runtime, ledgers and scheduler state
- Supabase Cron + Edge Function: PAPER orchestration

Do not migrate infrastructure simply for novelty. A replacement must demonstrate measurable benefit in reliability, cost, latency or operational capability.

Heavy statistical validation should not be moved into latency/CPU-constrained edge execution if GitHub Actions or another batch worker is a better fit.

## 9. Sprint 5R Hard Exit Gate

Sprint 5R is complete only when all of the following are true:

### Decision chain
- Evidence refresh precedes PAPER cycle in the reviewed scheduler lineage
- new ENTER fails closed without qualifying Evidence/governance/risk
- protective exits remain active during Evidence degradation
- Scenario/Council/decision/execution provenance is reconstructable

### Operator terminal
- Monitor terminal works on desktop/mobile
- Positions inspector works on desktop/mobile
- Audit terminal works on desktop/mobile
- Lab terminal works on desktop/mobile
- no document-level horizontal overflow
- no synthetic values or hidden missing links

### Validation
- dependency security gate PASS
- TypeScript PASS
- trading core tests PASS
- production build PASS
- Paper-cycle bundle smoke PASS
- Evidence-refresh bundle smoke PASS
- Trading-readiness bundle smoke PASS
- Supabase scheduler Edge bundle smoke PASS
- terminal desktop/mobile Playwright QA PASS

### Deployment
- exact Preview revision verified
- deployed operator QA PASS
- `/api/trading-readiness` reviewed
- explicit human PAPER rollout approval

No automatic production merge or scheduler rollout is authorized by this document.

## 10. Post-5R roadmap

### Sprint 6 — Research-Grade Validation v2
- Sharpe / Sortino / downside deviation
- confidence intervals
- Deflated Sharpe Ratio
- Probability of Backtest Overfitting
- multiple-testing/search-space lineage
- block/regime-preserving Monte Carlo
- execution-cost/slippage distributions
- Expected Shortfall / tail risk
- forecast Brier score / log loss / reliability calibration

### Sprint 7 — Strategy Factory & empirical Council evaluation
- Strategy Genome lifecycle
- candidate generation/competition
- agent/lens contribution measurement
- Council calibration and disagreement value
- human-reviewed Champion/Challenger promotion

### Sprint 8 — PAPER qualification
- fresh post-release validation window
- stable Evidence/integrity coverage
- empirical grade history and downgrade surveillance
- strategy/portfolio qualification

### Sprint 9 — Small-Live Candidate architecture
Small-live remains a separately reviewed human-approved stage. No automatic transition from PAPER is allowed.
