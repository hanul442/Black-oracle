# BLACK ORACLE Product Constitution v1

Status: APPROVED BASELINE
Date: 2026-09-11
Scope: Product identity, investment authority, system boundaries, UX principles, promotion governance

## 1. Product Definition

BLACK ORACLE is an autonomous investment operating system that makes investment decisions traceable, testable, reproducible, and progressively automatable from market evidence through strategy selection, risk, execution, outcome, and calibration.

Official definition:

> 증거에서 거래 결과까지 모든 투자 결정을 검증·재현하는 자율 투자 운영체제.

The target product combines an autonomous investment engine with an AI hedge-fund operations console. It is not a stock-tip application, a news dashboard, a single-strategy trading bot, or a generic AI chat interface.

The first production user is the operator. External access, monetization, and multi-user SaaS concerns are secondary until the engine is operationally trustworthy.

## 2. Primary Objectives

BLACK ORACLE optimizes for both absolute return and survival-aware, risk-adjusted performance.

The current one-month +10% / KRW 10M PAPER objective is an aspirational operating target. It is not, by itself, a promotion gate and must never override risk, robustness, calibration, or operational-integrity requirements.

Promotion quality is judged from a portfolio of evidence including:

- net return and expectancy
- drawdown and tail loss
- Sharpe / Sortino where sample quality permits
- profit factor and payoff asymmetry
- out-of-sample performance
- regime stability
- Monte Carlo survival
- parameter robustness
- calibration quality
- sample size and effective independence
- execution quality and slippage sensitivity
- operational stability and data quality

No single metric may compensate for a failed hard gate.

## 3. First-Class Decisions

The canonical decision set is:

- LONG
- SHORT
- NO_TRADE

NO_TRADE is a first-class investment decision, not a missing prediction or an error state. Its opportunity cost, avoided loss, false block rate, and calibration must be evaluated prospectively.

## 4. Canonical Decision Flow

The target decision path is:

Market Data / Fundamentals / Microstructure / NARS
→ Evidence Fabric
→ Market State
→ Strategy Factory / Strategy Vault
→ Strategy Router
→ AI Council
→ Independent Red Team
→ Arbiter
→ Deterministic Risk
→ Execution
→ Order / Trade
→ Outcome
→ Calibration / Attribution
→ Champion–Challenger Learning

Every material step must be connected through canonical lineage and recoverable from a trace identifier.

## 5. Authority Model

### 5.1 Deterministic Risk is sovereign

Council, models, strategies, or operator-facing AI explanations may never bypass deterministic portfolio and execution risk controls.

### 5.2 Council authority progresses by evidence

Council begins shadow-only. Authority may advance only through measured prospective performance:

SHADOW
→ REVIEWED ADVISORY
→ LIMITED VETO / SIZING AUTHORITY
→ CONDITIONALLY AUTHORIZED

Production execution authority is not granted by prompt confidence, majority voting, or a successful backtest.

### 5.3 Fail-closed incident policy

When data integrity, runtime state, model validity, or execution infrastructure is materially uncertain:

- new risk is blocked
- existing positions remain observable
- risk-reducing exits, stop-losses, take-profits, and emergency protection remain permitted
- no component may fabricate missing data to remain operational

## 6. Strategy Constitution

BLACK ORACLE uses a portfolio of strategies rather than one permanent master strategy.

The Strategy Factory may autonomously:

- generate candidates
- run backtests
- perform walk-forward / OOS validation
- stress-test candidates
- run Monte Carlo analysis
- register experiments
- admit qualified candidates into Challenger / Shadow research

It may not automatically promote a strategy to production Champion or increase real capital authority.

Strategy Router selects among eligible strategies using current market state, empirical strategy quality, conflict rules, capacity, and portfolio context. Regime is an auxiliary input to routing and validation, not an unquestionable master classifier.

## 7. Evidence Constitution

NARS is an internal Evidence Fabric producer for BLACK ORACLE.

Evidence improves a decision's information set, provenance, explanation, and confidence, but Evidence is not an unconditional execution permit.

A trade may be considered without external/news Evidence when the governing Strategy Grade and all other Router, Council, Risk, portfolio, and execution gates are satisfied.

Therefore the legacy invariant:

> No Evidence → No New Risk

is not part of the target constitution.

Its removal must be implemented through an explicit versioned policy change with regression tests and before/after attribution. Existing PAPER qualification samples must not be silently mixed across materially different execution policies.

Evidence must still be:

- source-backed when claimed as factual
- timestamped
- provenance-aware
- contradiction-aware
- non-fabricated
- connected to decision lineage when used

## 8. Council Constitution

The approved direction is Council v3:

Core Team:

- Chief Market Strategist
- Evidence Intelligence Officer
- Quant & Model Validation Lead
- Trade Architect

Independent Red Team:

- Director of Adversarial Research

Dynamic specialists are activated only when their domain data is available and relevant.

Council must distinguish:

- FACT
- INFERENCE
- ASSUMPTION
- COUNTEREVIDENCE
- DATA_GAP

Majority voting, seniority weighting, and naive confidence averaging must not be the final decision mechanism. The Arbiter evaluates evidence quality, conflict, invalidation, missing data, and risk-relevant dissent.

## 9. Canonical Ledger and Decision Replay

Decision Replay is a core product capability.

The system must be able to answer, for any trade or NO_TRADE decision:

- what data was known at decision time
- what evidence was attached
- which strategies were eligible and rejected
- which strategy was selected and why
- what Council members independently concluded
- what the Red Team challenged
- what changed after debate
- what the Arbiter decided
- what deterministic Risk allowed
- what order was sent
- what fill occurred
- how the position was protected
- what outcome occurred
- whether the forecast was calibrated
- which component contributed positively or negatively

Canonical history is append-oriented. User interfaces consume read models / projections instead of requiring the entire operational checkpoint for every view.

## 10. Runtime Separation

The product must distinguish at least four different meanings of health:

1. Process / deployment liveness
2. Application readiness
3. Trading runtime health
4. Qualification / evidence validity

A failed database checkpoint query must not by itself make a healthy web process undeployable. Conversely, a Railway SUCCESS badge must never be interpreted as proof that scheduled trading cycles are healthy.

Runtime State, Canonical Event Ledger, read-optimized projections, and health telemetry must progressively be separated.

## 11. Promotion Gate

PAPER → real-capital promotion requires hard-gate evidence across:

- minimum valid sample
- OOS / walk-forward performance
- Monte Carlo survival
- drawdown compliance
- calibration
- execution realism
- data quality
- lineage completeness
- runtime / scheduler stability
- recovery behavior

Promotion remains blocked if a hard gate is unresolved even when headline return is high.

Real capital begins as canary capital and scales in stages only after further evidence.

## 12. Market Priority

Near-term product and validation priority is equities first, while preserving existing crypto research and PAPER infrastructure where it remains useful.

Expansion should be evidence-driven rather than simultaneous multi-asset sprawl.

## 13. Product Surface Constitution

BLACK ORACLE is mobile-centric.

Primary mobile information architecture:

- Home
- Market
- Trade
- Log
- More

The default visual direction is Light Primary, approximately Bloomberg information discipline × Apple interaction clarity.

The product must feel like an institutional operations console reduced to a highly legible mobile surface, not a decorative cyberpunk dashboard.

### Home

Home answers:

- What is the system seeing?
- What is it deciding?
- What is it doing?
- What is at risk?
- What changed recently?

### Market

TradingView-level analytical interaction is the target. Price, strategy state, evidence, decisions, and entries/exits should progressively converge on a shared timeline where the data exists.

### Trade

PAPER is presented with the operational discipline of a real broker workstation, with unmistakable PAPER labeling and no fake execution data.

### Log

Technical / system logs and trading / investment logs are separate user projections even when they originate from the same canonical event lineage.

### Portfolio

Portfolio must converge on:

- P&L
- exposure
- attribution
- risk
- position protection
- strategy contribution
- decision lineage

### Council

Normal surfaces prioritize the decision result. Detailed persona reasoning, dissent, Red Team challenges, revisions, and data gaps become visible on drill-down.

## 14. Legacy Removal Policy

Legacy features do not survive merely because they already exist.

Case, Hypothesis, and Scenario-era product surfaces are not part of the target top-level product unless they are re-expressed as useful internal trading objects. Dead navigation, duplicated logs, mock data, obsolete Firebase-era product assumptions, and stale documentation should be retired deliberately.

Removal requires checking dependencies and migration impact; deletion must not destroy audit history.

## 15. Non-Fabrication Rule

BLACK ORACLE must never invent values merely to complete a visual or AI response.

If data is unavailable, the product shows unavailable / insufficient data / not yet calibrated.

This applies to:

- prices
- forecast distributions
- probability
- grades
- evidence
- Council inputs
- portfolio values
- historical outcomes
- performance metrics

## 16. Change Control

Any future change that materially alters one of the following requires an explicit versioned policy decision:

- execution eligibility
- risk limits
- position sizing
- Evidence authority
- Council authority
- strategy promotion
- qualification sample semantics
- real-capital authority

Historical qualification data must not be silently combined across incompatible policies.

---

This constitution is the product-level source of truth. Implementation details may evolve, but a Sprint that violates these invariants must either be corrected or explicitly amend this document before promotion.