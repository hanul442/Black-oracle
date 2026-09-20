# Cycle 006 — LLM strategy discovery, multi-agent investment committee, and hierarchical portfolio routing

Date: 2026-09-20  
Research IDs: AIML-005, AIML-006, Q-002  
Status: TEST / REFERENCE  
Experiments: EXP-AIML005, EXP-AIML006, EXP-Q002  
Production impact: None

## Executive summary

Three recent research lines map directly onto BLACK ORACLE's intended architecture:

1. **LLM-driven strategy discovery** — generate executable alpha candidates, evaluate them with specialized agents, and adapt weights to market conditions.
2. **Trading-firm-style multi-agent decision graphs** — separate evidence gathering, Bull/Bear debate, trading proposal, risk review, and portfolio approval rather than treating Council as a flat vote.
3. **Hierarchical portfolio aggregation with sentiment** — combine structured market/risk features and point-in-time sentiment through layered agents rather than a single monolithic policy.

The papers support the *shape* of BLACK ORACLE's Strategy Factory → Council → Router → Portfolio architecture. They do **not** prove that the same architecture will generate alpha in BLACK ORACLE. All three should enter the R&D loop as sandbox experiments with strict point-in-time data, complete trial-family accounting, transaction-cost-aware evaluation, and no live/paper production impact.

---

## 1. Kou et al. — Automate Strategy Finding with LLM in Quant Investment

**Source**  
Zhizhuo Kou et al. (2025), *Automate Strategy Finding with LLM in Quant Investment*, Findings of EMNLP 2025, ACL Anthology.

**Evidence grade**  
**B+** — peer-reviewed conference paper with substantive experiments, but BLACK ORACLE has not independently reproduced the reported performance or verified full external validity.

**Reported architecture**

The paper presents a three-stage pipeline:

```text
LLM alpha generation
        ↓
multi-agent / multimodal factor evaluation
        ↓
dynamic weight optimization by market condition
        ↓
combined strategy
```

The alpha-generation stage uses prompt-engineered LLMs to propose executable factor candidates from diverse financial inputs. The evaluation layer filters candidates based on predictive quality, market state, risk preference, and category balance. A dynamic weighting stage then adjusts the contribution of selected factors to changing market conditions.

The paper reports 53.17% cumulative return on SSE50 from Jan 2023 to Jan 2024. This is a **reported research result, not a BLACK ORACLE expectation** and must be reproduced with independent point-in-time data and realistic costs before it influences product decisions.

### BO mapping

| Paper concept | BLACK ORACLE component | Current design implication |
|---|---|---|
| Seed alpha generation | Strategy Factory / Genome | Candidate generation should output executable, typed factor definitions rather than prose ideas |
| Multi-agent factor screening | Council / Validator | Candidate promotion should require independent quantitative and risk evidence |
| Category balance | Strategy Vault / research family | Avoid one factor family dominating because search generated many near-duplicates |
| Dynamic weight optimization | Strategy Router | Router should be evaluated as an adaptive allocation layer, not only a hard strategy selector |
| Strategy composition | Portfolio Policy | Multiple approved signals may be combined only after independent OOS validation |

### Gap exposed in BO

BLACK ORACLE has Strategy Factory / Genome / Router concepts, but the R&D contract still needs an explicit **candidate specification** defining:

- factor expression / executable transform
- required inputs and their knowledge-time contract
- parameter/version lineage
- generator model/prompt/config fingerprint
- trial-family identity
- compile/sanity checks
- in-sample, validation, and untouched OOS manifests
- correlation/redundancy against the active factor library
- promotion/rejection reason

### EXP-AIML005 — Minimal Alpha Factory replication

**Question**  
Can an LLM generate syntactically valid, economically interpretable factor candidates that survive leakage checks and provide non-redundant OOS information after accounting for the full research budget?

**Sandbox protocol**

1. Restrict generation to a typed factor DSL / allow-listed operator set.
2. Generate a fixed-budget candidate family; log every generated, repaired, rejected, and promoted candidate.
3. Run static checks for invalid inputs, future references, unstable transforms, and duplicated formulas.
4. Evaluate factor IC/RankIC, turnover, coverage, redundancy, and cost-aware portfolio impact on point-in-time data.
5. Use purged/embargoed temporal validation and preserve one untouched OOS window.
6. Compare against simple human-authored baseline factors under the same research budget.

**Primary metrics**

- compile / executable rate
- leakage rejection rate
- unique/non-redundant candidate rate
- OOS IC / RankIC stability
- cross-regime stability
- turnover and estimated implementation cost
- Deflated Sharpe / multiple-testing diagnostics at the family level
- percentage of generated candidates that survive each gate

**Promotion condition**  
No promotion from “interesting formula” alone. A generated factor must survive point-in-time checks, complete trial accounting, redundancy analysis, and untouched OOS evaluation.

---

## 2. Xiao et al. — TradingAgents: Multi-Agents LLM Financial Trading Framework

**Source**  
Yijia Xiao, Edward Sun, Di Luo, Wei Wang, *TradingAgents: Multi-Agents LLM Financial Trading Framework*, arXiv:2412.20138 and the TauricResearch open-source implementation.

**Evidence grade**  
**A- as an architecture / implementation precedent; B for performance evidence.** The project is open source and actively maintained, but trading performance is sensitive to model choice, prompts, data vendors, date handling, and non-determinism.

### Architecture

TradingAgents models a trading firm rather than a single LLM:

```text
Fundamental / Sentiment / Technical analysts
                    ↓
            Bull ↔ Bear debate
                    ↓
             Research Manager
                    ↓
                  Trader
                    ↓
             Risk Management
                    ↓
        Portfolio / Fund Manager
```

This is directly relevant to BLACK ORACLE because it treats **decision topology** as part of the system design. Evidence producers, thesis challengers, the trading proposal, risk review, and final approval are distinct roles.

### Important 2026 correctness lesson

The maintained TradingAgents project introduced multiple look-ahead / point-in-time corrections through 2026. Its September 2026 v0.5.0 release states that dated data paths were hardened for point-in-time integrity, SEC EDGAR fundamentals are served as filed, and ticker/date-grid backtesting plus portfolio-aware runs were added.

For BLACK ORACLE, the important lesson is not the vendor or exact codebase. It is that **multi-agent reasoning becomes invalid if any agent sees information that was not available at the decision timestamp**. Council quality cannot compensate for contaminated evidence.

### BO mapping

| TradingAgents role | BLACK ORACLE interpretation |
|---|---|
| Specialist analysts | Evidence-producing Council members |
| Bull / Bear researchers | Thesis / Anti-Thesis adversarial review |
| Research Manager | Council synthesis layer |
| Trader | Trade proposal / execution-intent generator |
| Risk team | Risk veto, sizing constraints, stress review |
| Fund Manager | Portfolio approval / capital allocator |

### EXP-AIML006 — Council topology ablation

**Question**  
Does a structured decision graph outperform or improve governance relative to flat Council voting when both receive identical point-in-time evidence?

**Variants**

A. Flat independent vote  
B. Specialist evidence → synthesis  
C. Specialist evidence → Bull/Bear debate → synthesis  
D. C + risk veto / sizing  
E. D + portfolio-level approval

**Control requirements**

- same model family and inference budget where possible
- same evidence snapshot and knowledge-time cutoff
- same trade universe and execution assumptions
- repeated runs to quantify LLM non-determinism
- decision traces stored under stable BO IDs

**Metrics**

- decision stability across repeated runs
- contradiction detection / unresolved-conflict rate
- calibration of confidence vs outcomes
- false-positive trade rate
- drawdown / tail-loss contribution
- incremental latency and inference cost
- percentage of proposals modified or vetoed by risk/portfolio stages
- evidence citation / lineage completeness

**Decision principle**  
A more complex Council graph is justified only if it improves measurable decision quality, risk control, or auditability enough to compensate for latency, cost, and correlated-agent failure modes.

---

## 3. Coriat & Benhamou — HARLF

**Source**  
Benjamin Coriat and Eric Benhamou (2025), *HARLF: Hierarchical Reinforcement Learning and Lightweight LLM-Driven Sentiment Integration for Financial Portfolio Optimization*, arXiv:2507.18560 / SSRN.

**Evidence grade**  
**B** — substantive empirical preprint/workshop research with an open/reproducibility orientation, but not production evidence.

### Architecture

HARLF combines market/risk features and lightweight sentiment in a three-level hierarchy:

```text
base RL agents
      ↓
meta-agents
      ↓
super-agent
      ↓
portfolio allocation
```

The paper uses structured portfolio metrics such as Sharpe, Sortino, Calmar ratio, maximum drawdown, and volatility, with FinBERT-style news sentiment. It reports training on 2000–2017 and evaluation on 2018–2024, with 26% annualized return and Sharpe 1.2.

Those values are **reported by the paper**. They should not be treated as transferable performance expectations for BLACK ORACLE.

### BO mapping

```text
Market / factor agents ─┐
Risk metric agents ─────┼→ Meta Strategy / Router → Portfolio Policy
NARS sentiment ──────────┘
```

The useful design idea is hierarchical specialization: low-level agents process different evidence families, while upper levels aggregate them according to market state.

### Gap exposed in BO

Before testing sentiment-aware routing, BLACK ORACLE needs:

- point-in-time publication / ingestion timestamps for news
- a defined aggregation window
- source coverage controls so high-volume assets do not dominate
- stale-news and duplicate-story handling
- explicit missing-sentiment fallback
- transaction-cost and turnover accounting
- separation between “sentiment helps calibration” and “sentiment adds alpha”

### EXP-Q002 — Hierarchical / dynamic router benchmark

**Question**  
Does hierarchical aggregation or regime-aware dynamic weighting improve OOS risk-adjusted performance and drawdown control compared with static combination rules?

**Baselines**

1. Equal-weight approved signals
2. Static optimized weights
3. Regime-aware hard routing
4. Dynamic soft weighting
5. Hierarchical aggregator with and without sentiment

**Metrics**

- cost-adjusted OOS return
- Sharpe / Sortino / Calmar
- maximum drawdown and tail loss
- turnover
- regime-specific performance
- weight instability / concentration
- sensitivity to delayed or missing sentiment
- performance after regime transitions

**Required ablations**

- no sentiment vs sentiment
- no hierarchy vs hierarchy
- static vs dynamic weights
- perfect-timestamp synthetic control vs real availability timestamps

---

## Cross-paper synthesis for BLACK ORACLE

The combined architecture suggested by the three research lines is:

```text
DATA / NARS
    ↓
STRATEGY FACTORY
LLM → executable alpha candidates
    ↓
VALIDATION + EVIDENCE GATES
point-in-time / redundancy / OOS / research-budget accounting
    ↓
COUNCIL
specialists → Bull/Bear → synthesis → risk review
    ↓
STRATEGY ROUTER
regime-aware selection / dynamic weighting / no-trade
    ↓
PORTFOLIO POLICY
capital allocation / limits / execution intent
    ↓
PAPER / LIVE
    ↓
OUTCOME + EVIDENCE LEDGER
```

### Durable design principles

1. **Generation is not validation.** LLMs may expand the hypothesis space; they do not grant a candidate statistical credibility.
2. **Every generated candidate belongs to a trial family.** Rejected formulas and mutations must remain visible for multiple-testing diagnostics.
3. **Council topology is an experiment variable.** More agents and more debate are not automatically better.
4. **Risk review must be able to change the decision.** A risk agent that only explains a pre-selected trade is not a control layer.
5. **Router output must include No Trade.** Dynamic allocation should be allowed to abstain when support is weak.
6. **Sentiment requires knowledge-time semantics.** Publication time, availability time, aggregation window, and revisions must be reproducible.
7. **Point-in-time evidence dominates model sophistication.** A contaminated sophisticated pipeline is less useful than a simpler clean baseline.
8. **Performance claims remain external until independently reproduced.**

---

## Recommended experiment order

### Stage 0 — prerequisite
Complete **EXP-DI001 + EXP-DI003** first: canonical experiment record plus point-in-time feature manifest. These three papers increase the importance of the validation substrate; they do not justify bypassing it.

### Stage 1 — EXP-AIML005
Build a minimal Alpha Factory sandbox with a typed factor DSL and complete candidate-family accounting.

### Stage 2 — EXP-AIML006
Run the Council topology ablation on archived decisions / a fixed sandbox universe.

### Stage 3 — EXP-Q002
Benchmark static vs dynamic vs hierarchical routing only after the factor/evidence inputs are trustworthy.

### Stage 4 — integration candidate
If individual experiments pass, test:

```text
Alpha Factory → Council → Router → Portfolio
```

as a single end-to-end challenger against the existing champion. Do not replace the champion by architecture resemblance alone.

---

## Risks

- LLM-generated factors can produce a very large hidden multiple-testing burden.
- Multi-agent systems can create correlated errors and false confidence rather than independent judgment.
- Debate can optimize rhetoric instead of forecast quality.
- Dynamic routers can overfit regime definitions and increase turnover.
- Sentiment signals are especially vulnerable to timestamp leakage, duplicate coverage, and source-selection bias.
- Reported research returns may depend on market, period, data vendor, execution assumptions, or unreleased implementation details.
- Hierarchical complexity increases observability, replay, latency, and cost requirements.

---

## Decision

**TEST / REFERENCE.**

The three papers are strong enough to justify explicit BLACK ORACLE experiments and to sharpen the target architecture. They are not sufficient to change production or paper-trading behavior.

The immediate implication is architectural:

**Strategy Factory should generate typed candidates → evidence gates should validate them → Council should challenge and synthesize evidence → Router should choose/weight strategies under regime and uncertainty → Portfolio Policy should control capital and risk.**

The immediate engineering priority remains the validation substrate, because every one of these research directions fails if point-in-time evidence, experiment lineage, and research-budget accounting are weak.

## References

- Kou, Z. et al. (2025), *Automate Strategy Finding with LLM in Quant Investment*, Findings of EMNLP 2025. https://aclanthology.org/2025.findings-emnlp.1005/
- Xiao, Y., Sun, E., Luo, D., Wang, W. (2024/2025), *TradingAgents: Multi-Agents LLM Financial Trading Framework*, arXiv:2412.20138. https://arxiv.org/abs/2412.20138
- TauricResearch, *TradingAgents* maintained implementation / documentation. https://tauricresearch.github.io/TradingAgents/
- Coriat, B., Benhamou, E. (2025), *HARLF: Hierarchical Reinforcement Learning and Lightweight LLM-Driven Sentiment Integration for Financial Portfolio Optimization*, arXiv:2507.18560. https://arxiv.org/abs/2507.18560
