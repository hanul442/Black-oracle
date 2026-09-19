# BLACK ORACLE Current-State Audit — Re-foundation Disposition Matrix

> **Status:** AUDIT v1.0  
> **Date:** 2026-09-19  
> **Target baseline:** `main@38b43d16dd701da6a74e39e599def3be407a9297`  
> **Governing target:** `BLACK_ORACLE_REFOUNDATION_2026-09-19.md`  
> **Purpose:** 현재 구현 전체를 새 BLACK ORACLE 방향에 맞춰 존치 심사하고, 각 기능을 `AAA–F`로 평가하여 `KEEP / REDESIGN / MERGE / ARCHIVE / DELETE`로 분류한다.

---

# 0. Audit Decision

현재 BLACK ORACLE은 **좋은 부품이 부족한 시스템이 아니라, 좋은 부품 위에 너무 많은 실행·중재 계층이 쌓인 시스템**이다.

가장 큰 문제는 기능 부족이 아니다.

1. AutoTrade/PAPER 중심 아키텍처가 제품 전면을 지배한다.
2. Strategy → Router → Council → Red Team → Arbiter → Risk → Execution으로 판단 계층이 과도하게 길다.
3. Council, Strategy, Technical Analysis, Validation이 서로 중복된 판단을 한다.
4. 모바일 UI가 사용자의 투자 리서치보다 내부 런타임 관찰 화면에 가깝다.
5. 반대로 이미 구현된 **Market data provenance, NARS, Canonical Event Ledger, Decision Replay, Forecast Calibration, Strategy validation, Volume/large-participant analytics**는 새 제품에서도 강한 핵심 자산이다.

따라서 권고는 **전체 재작성**이 아니다.

> **보존할 데이터·검증·리서치 기반은 살리고, AutoTrade orchestration과 중간 의사결정 계층을 걷어낸 뒤 Market / Reports / Council / Marketplace / Forecast 구조로 재조립한다.**

---

# 1. Audit Scope & Evidence

## 1.1 GitHub

현재 `main` tree를 재귀적으로 확인했다.

- Total blobs: **513**
- TypeScript: **273**
- TSX: **68**
- SQL: **64**
- Markdown: **50**
- 주요 영역:
  - `api/`
  - `src/trading/`
  - `server/trading/`
  - `services/nars/`
  - `src/mobile/`
  - `src/views/`
  - `supabase/`
  - `docs/`
  - `ops/`

이 감사는 test 파일을 개별 제품 기능으로 등급화하지 않고, **test가 보호하는 기능 단위**로 묶어 판정한다.

## 1.2 Railway

Production project에는 현재 네 서비스가 존재한다.

- `black-oracle-web`
- `black-oracle-paper-vnext`
- `black-oracle-paper-s2-shadow`
- `black-oracle-paper-v9-multiasset`

네 서비스 모두 Railway의 latest deployment state는 SUCCESS였으나, **SUCCESS는 product/runtime semantic health와 동일하지 않다.**

기존 B0 문서가 기록한 exact-source mismatch 및 runtime health UNKNOWN 문제도 별도 해결 대상이다.

## 1.3 Supabase

GitHub의 Supabase migrations/functions 및 B0 audit artifact는 검토했다.

이번 세션의 live Supabase catalog/table query는 반복적으로 **connection timeout**이 발생했다.

따라서:

- Git source / migrations / prior B0 evidence: **확인됨**
- 현재 live database catalog의 독립 재검증: **확인 필요**
- live DB를 확인했다고 간주하여 삭제 결정을 실행해서는 안 됨

## 1.4 No destructive action

이번 감사에서는 다음을 수행하지 않았다.

- Railway 서비스 삭제
- Supabase table/function/migration 변경
- Scheduler 변경
- PAPER position/order mutation
- runtime variable 변경
- legacy data 삭제

이 문서는 **구조조정 판정**이지 즉시 삭제 명령이 아니다.

---

# 2. Grade & Disposition Rules

| Grade | 의미 | 기본 조치 |
| --- | --- | --- |
| **AAA** | 새 제품 정체성의 핵심 자산 | KEEP / STRENGTHEN |
| **AA** | 경쟁우위를 만드는 강한 기반 | KEEP |
| **A** | 가치 높으나 새 구조에 맞춘 재설계 필요 | REDESIGN |
| **BBB** | 유용하지만 중복·복잡도가 존재 | MERGE / OPTIONAL |
| **BB** | 현 구조에 묶여 있고 가치 대비 복잡도가 큼 | DEPRECATE |
| **B** | 제품에서는 제거하되 역사/검증 가치 있음 | ARCHIVE |
| **C** | 대부분 대체 가능 | ARCHIVE / DELETE candidate |
| **D** | 새 방향과 구조적으로 충돌 | DELETE after migration |
| **F** | 명확한 중복/폐기 대상 | DELETE after dependency proof |

Disposition:

- **KEEP** — 이름과 책임을 유지해도 됨
- **REDESIGN** — 핵심은 유지하되 인터페이스/책임을 새 제품에 맞춰 변경
- **MERGE** — 별도 계층을 없애 다른 기능에 흡수
- **ARCHIVE** — 사용자 제품/active architecture에서 제거하되 코드·데이터는 보존
- **DELETE** — 의존성·데이터 보존 확인 뒤 코드 삭제

---

# 3. Executive Grade Matrix

| Area | Grade | Disposition | 결론 |
| --- | --- | --- | --- |
| Market data provenance/freshness | **AAA-** | KEEP | 새 Chart/Market의 신뢰 기반 |
| Instrument-centric Cockpit/lineage | **AAA** | REDESIGN | Asset Detail/Oracle의 기반 |
| Canonical Event Ledger | **AAA** | KEEP + REDESIGN schema | Forecast/Report/Expert/Method 역사 기록의 핵심 |
| Decision Replay | **AAA** | REDESIGN | 차트 위 과거 판단 재생으로 승격 |
| Forecast calibration | **AAA-** | REDESIGN | 미래 가격 예측 Track Record 기반 |
| NARS | **AAA-** | REDESIGN | Event Intelligence로 승격 |
| AI usage/cost ledger | **AA+** | KEEP | Credits/원가/요금제 기반 |
| Large Participant Footprint | **AA+** | KEEP | 소형주/Crypto 차별화 핵심 |
| Volume Absorption | **AA** | KEEP | Volume-first Technical의 강한 구성요소 |
| Autonomous validation engine | **AA-** | REDESIGN | Method Marketplace 검증 엔진으로 재사용 |
| Monte Carlo / OOS / walk-forward | **AA** | KEEP | Method qualification 핵심 |
| Strategy Experiment Ledger | **AA-** | REDESIGN | Method track record로 전환 |
| Council persona system | **A+** | REDESIGN | 6 Core + Expert Marketplace의 씨앗 |
| 24-person Investment Committee definitions | **A** | MERGE | Always-on Council 폐기, Expert Pool로 전환 |
| Council debate API | **A** | REDESIGN | Arbiter 제거 후 실제 토론 transcript로 전환 |
| Sector runtime | **A-** | REDESIGN | Sector Discovery 기반 |
| Market state | **BBB+** | REDESIGN | risk multiplier 제거, 분석 컨텍스트만 유지 |
| Technical indicator library | **BBB+** | KEEP OPTIONAL | Method 도구상자로 유지 |
| Technical Evidence fusion | **BB+** | REDESIGN | 지표 과밀, Price/Volume/MA 중심으로 재작성 |
| Evidence Store / external evidence | **A** | REDESIGN | Report/Council evidence layer로 유지 |
| Evidence Forecast | **A-** | REDESIGN | 방향성 forecast → price-path forecast로 확장 |
| Trade Map | **A-** | MERGE | Execution map이 아니라 Report scenario map |
| Strategy Router | **D** | DELETE | Method-aware Technical synthesis가 대체 |
| Shadow Arbiter | **D** | DELETE | Council 이후 불필요한 중재 계층 |
| AI Shadow Adjudicator | **C** | ARCHIVE | PAPER event 중심; 일부 구조화/비용 로직만 재사용 |
| Red Team as separate pipeline | **BBB** | MERGE | Skeptic Core Expert 또는 invited expert로 흡수 |
| Deterministic Risk Engine | **C+** | ARCHIVE / EXTRACT | product layer 제거, 최소 guardrail만 추출 |
| Execution Policy | **D** | ARCHIVE | AutoTrade 제거로 active product 책임 소멸 |
| Position Sizing | **C** | ARCHIVE | simulation utility로 제한 |
| Paper Broker/Portfolio | **B+** | ARCHIVE | Method validation sandbox로만 보존 |
| Paper Protection stack | **B** | ARCHIVE | historical validation/debug 가치만 유지 |
| Runtime profile/qualification | **B** | ARCHIVE | live product에서 제거, frozen historical runtime |
| PAPER schedulers | **B** | ARCHIVE / DECOMMISSION later | 새 제품에 직접 필요 없음 |
| Current Strategy Factory random genomes | **BB** | MERGE / ARCHIVE | validation machinery만 살리고 indicator soup 폐기 |
| Current V11.1 mobile product | **B+** | ARCHIVE reference | patch 계속 금지; 새 IA 구축 |
| V2–V10/V11 old mobile versions | **F** | DELETE after migration | 명확한 중복 UI debt |
| Desktop internal views | **C** | ARCHIVE internal | 소비자 제품에서 제거 |
| Firebase/Firestore product store | **D** | DELETE after migration | Supabase/API와 이중 source-of-truth |
| Legacy Hypothesis/Scenario/Case UI | **C** | MERGE / ARCHIVE | Report 내부 reasoning artifact로 흡수 |
| Legacy Report model | **BB** | REPLACE | Report v2 필요 |
| Watchlist legacy UX | **BBB** | REDESIGN | 새 Home/Market Favorites로 재구현 |
| Activity Brief | **BBB+** | MERGE | Market/Report/Council feed 요약에 흡수 |
| Existing README/Product Constitution v2 | **C** | SUPERSEDE | AutoTrade 전제라 새 기준과 충돌 |
| Existing Master Plan v3 | **C** | SUPERSEDE | AutoTrade 중심 sprint ordering 폐기 |
| B0 runtime/source-truth audit artifacts | **A** | KEEP historical | product 논리는 구식이어도 migration 안전에 중요 |
| Marketplace | **N/A** | NEW BUILD | 현재 제품 구현 없음 |
| Expert Creator | **N/A** | NEW BUILD | 현재 구현 없음 |
| Method Creator | **N/A** | NEW BUILD | validation 기반 위 신규 구축 |
| Forecast Price Path UI | **N/A** | NEW BUILD | 현재 방향성 calibration은 있으나 path UI 없음 |
| Report v2 | **N/A** | NEW BUILD | 현 Firestore report와 별도 구축 |
| Marketplace League/Season | **N/A** | NEW BUILD | 신규 |
| Credits entitlement product layer | **N/A** | NEW BUILD | AI cost ledger를 기반으로 구축 |

---

# 4. Detailed Audit — Market, Data, Chart

## 4.1 Market Data Provider & Provenance

**Grade: AAA-**  
**Disposition: KEEP**

Relevant:
- `server/trading/marketDataProvider.ts`
- `api/market-chart.ts`
- `api/market-chart-kis.ts`
- KRX / Yahoo / KIS / Upbit data adapters
- freshness and provenance utilities

### Why keep

현재 구조의 좋은 점은 가격 데이터를 “있어 보이는 값”으로 만들지 않고:

- provider
- quality
- observed time
- received time
- execution eligibility
- research/display-only 여부

를 분리한다는 점이다.

새 BLACK ORACLE은 TradingView형 Chart가 전면에 오므로 이 데이터 신뢰 계층은 오히려 더 중요해진다.

### Change

`executionEligible`는 consumer UI 핵심 필드에서 내려도 되지만, **data quality/provenance/freshness는 유지**한다.

---

## 4.2 Instrument Cockpit / Instrument Lineage

**Grade: AAA**  
**Disposition: REDESIGN**

Relevant:
- `api/instrument-cockpit.ts`
- `server/instrumentDecisionLineage.ts`
- event-ledger instrument projections

현재 이미 특정 종목 기준으로:

- latest decision
- latest Council
- event lineage
- stage counts

를 조립할 수 있다.

이것은 새 `Asset Detail → Oracle` 탭의 거의 직접적인 backend foundation이다.

### New role

```text
Instrument Cockpit
→ Asset Intelligence API
→ Chart markers
→ Reports
→ Forecast history
→ Expert opinions
→ Events
```

이름은 내부 구현명으로 남길 수 있으나 제품 용어로는 `Oracle` 또는 `Research`가 적합하다.

---

## 4.3 Current Chart Renderer

**Grade: A-**  
**Disposition: REDESIGN**

Relevant:
- `src/mobile/v9/IntegratedMarketChart.tsx`

장점:

- 실제 OHLCV를 사용
- data gap을 숨기지 않음
- provenance/freshness 표시
- entry/stop/TP overlay 기초 존재

문제:

- 현재 chart는 PAPER position/trade map 중심
- report marker layer 없음
- historical grade layer 없음
- forecast future path 없음
- expert drawing/annotation layer 없음
- advanced drawing interaction이 제한적

### Decision

**데이터 레이어는 보존하고 renderer/UI는 새로 설계한다.**

Target layers:

- Candles
- Volume
- MA
- Expert annotations
- Report markers
- Grade history
- NARS event markers
- Forecast paths
- Entry / invalidation / TP zones

---

# 5. Detailed Audit — NARS, Evidence, Sector Intelligence

## 5.1 NARS Core

**Grade: AAA-**  
**Disposition: REDESIGN / STRENGTHEN**

NARS에는 이미:

- source provenance
- source diversification
- primary source resolver
- official feed expansion
- clustering
- evidence scoring
- calibration
- evidence acquisition
- Black Oracle fan-out

이 존재한다.

### New role

NARS를 거래 permission용 Evidence Gate로 보지 않고:

> **Event Intelligence & Evidence Network**

로 승격한다.

Output:

```text
Event
→ Market
→ Sector
→ Company / Asset
→ affected Experts
→ Report / Council context
```

---

## 5.2 NARS Coverage Acquisition

**Grade: A**  
**Disposition: REDESIGN**

Relevant:
- `server/trading/narsCoverageAcquirer.ts`

현재 web discovery가 특정 instrument에 대한 recent sources를 찾는다.

장점:
- primary/official source 선호
- 허구 URL/기사 금지
- NARS를 거친 뒤 evidence화
- 직접 BUY/SELL하지 않음

위험:
- “찾으라고 요청된 종목”을 중심으로 web 검색하면 기사량 많은 섹터가 더 풍부한 Evidence를 얻음
- 결과적으로 AI/반도체 등 미디어 밀도가 높은 영역이 구조적으로 유리할 수 있음

### Required redesign

```text
BAD
Web abundance
→ sector appears important
→ candidates

TARGET
Market/sector universe scan
→ price/volume/fundamental/event anomaly
→ candidate
→ NARS evidence acquisition
→ Council/Report
```

**News popularity must not become candidate-generation weight by accident.**

---

## 5.3 Evidence Store

**Grade: A**  
**Disposition: REDESIGN**

현재 Evidence Store는 trading evidence에 맞춰져 있다.

새 구조에서는:

- Report evidence
- Expert evidence
- Event evidence
- Forecast evidence snapshot

으로 일반화한다.

Evidence에는 최소:

- source
- provenance
- observedAt
- publishedAt
- relevance
- entity links
- event links
- contradiction links
- source quality
- version

을 유지한다.

---

## 5.4 Sector Runtime

**Grade: A-**  
**Disposition: REDESIGN**

Relevant:
- `src/trading/marketSectorRuntime.ts`
- `src/trading/sectorStrengthRuntime.ts`
- KRX market/sector observations

현재는 market state + sector packets를 shadow runtime에 제공한다.

새 제품에서는 이를 **Sector Discovery**로 올린다.

Target:
- sector trend
- sector breadth
- earnings/revision if available
- event momentum
- capital/volume flow
- valuation where supported
- relative performance
- data confidence

현재 evidence 평균을 단순 sector attractiveness로 오해하지 않도록 수정해야 한다.

---

# 6. Detailed Audit — Technical Analysis

## 6.1 Core Technical Philosophy

Target default:

1. **Price**
2. **Volume**
3. **Moving Average**

나머지는 optional Method.

현재 기술분석 코드는 이보다 훨씬 넓은 indicator universe를 가지고 있으므로 **계산 라이브러리는 보존하되 기본 판단 흐름을 다이어트**한다.

---

## 6.2 Indicator Library

**Grade: BBB+**  
**Disposition: KEEP OPTIONAL**

Relevant:
- `src/trading/indicators.ts`
- `src/trading/indicatorCatalog.ts`

현재:
- EMA
- RSI
- Stoch RSI
- ATR
- Bollinger
- MACD
- ROC
- Z-score
- 기타 구조/flow tools

삭제할 필요는 없다.

하지만 기본 Technical Expert가 모든 것을 사용해서는 안 된다.

### New role

```text
Core
Price + Volume + MA

Optional Methods
RSI / MACD / Bollinger / VWAP / Volume Profile / ICT-style / etc.
```

---

## 6.3 Technical Evidence Fusion

**Grade: BB+**  
**Disposition: REDESIGN**

Relevant:
- `src/trading/technicalEvidence.ts`

현재 raw transforms를 evidence families로 압축하고 correlation penalty를 계산한다.

좋은 의도지만 새 제품 기준으로는:

- 사용자가 무엇을 보고 있는지 이해하기 어려움
- Method conflict를 한 directional score로 압축
- Volume이 보조 항목으로 취급됨
- Technical Analyst가 실제 차트를 읽고 설명하는 경험과 거리 있음

### Replace with

```text
Technical Expert
├─ Core read: Price / Volume / MA
├─ Method A result
├─ Method B result
├─ Method C result
└─ Conflict explanation
```

충돌은 버그가 아니라 **Report/Council에 공개할 정보**다.

---

## 6.4 Large Participant Footprint

**Grade: AA+**  
**Disposition: KEEP / STRENGTHEN**

Relevant:
- `src/trading/largeParticipantFootprint.ts`

이미 다음을 본다.

- abnormal volume ratio
- recent volume expansion persistence
- breakout/breakdown participation
- close location
- absorption-like behavior
- extreme volume with little price movement 경고

특히 “거래량이 극단적으로 큰데 가격이 거의 움직이지 않으면 accumulation으로 단정하지 않는다”는 방어 로직은 새 철학과 잘 맞는다.

### Target

Small-cap / Crypto specialist의 기본 Method 후보로 승격.

---

## 6.5 Volume Absorption

**Grade: AA**  
**Disposition: KEEP**

Relevant:
- `src/trading/volumeAbsorption.ts`

단순 volume spike가 아니라 가격 반응까지 요구한다.

새 Technical 방향에 잘 맞으며, Marketplace Method로 versioning할 가치가 있다.

---

## 6.6 ICT-style Methods

**Status: NEW METHOD FAMILY**

현재 market structure / liquidity sweep 등 일부 유사 기능은 존재하지만, ICT 전체를 하나의 검증된 시스템으로 구현했다고 볼 근거는 없다.

권고:

- `ICT Liquidity`
- `FVG Retest`
- `Liquidity Sweep + MSS`

등을 **별도 Method**로 만들고 Backtest/Forward Test한다.

ICT를 기본 진리로 합치지 않는다.

---

# 7. Detailed Audit — Strategy → Method Migration

## 7.1 Strategy Router

**Grade: D**  
**Disposition: DELETE after dependency migration**

Relevant:
- `src/trading/strategyRouter.ts`

현재 route:

- TREND_MOMENTUM
- MEAN_REVERSION
- BLENDED
- NO_TRADE

새 구조에서는 별도 Router가 필요하지 않다.

Technical Expert가 여러 Method 결과를 보고:

- agreement
- conflict
- applicability
- data gap

을 설명하면 된다.

Router가 다시 최종 signal을 하나로 압축하면 새 설계 취지와 충돌한다.

---

## 7.2 Strategy Factory Candidate Generator

**Grade: BB**  
**Disposition: MERGE / ARCHIVE**

Relevant:
- `src/trading/strategyFactory.ts`

현재 3–6개 indicator 조합을 genome으로 만들고 weight를 무작위/유도 생성한다.

문제:

- 새 “technical diet”와 반대 방향
- indicator soup를 자동 생성
- 사용자에게 설명하기 어려운 composite strategy가 양산될 위험

### Preserve

- version identity
- reproducible candidate concept
- evaluation scaffolding
- correlation awareness

### Retire from default

- random multi-indicator combinations as primary discovery model
- hard-gate language
- Strategy-as-first-class product ontology

---

## 7.3 Autonomous Strategy Factory Validation

**Grade: AA-**  
**Disposition: REDESIGN → Method Validation Engine**

Relevant:
- `src/trading/autonomousStrategyFactory.ts`
- `src/trading/strategyFactoryBacktest.ts`
- `server/trading/strategyFactoryRunner.ts`

강점:

- backtest
- blind validation
- walk-forward
- cost stress
- regime stress
- Monte Carlo survival
- parameter robustness
- lifecycle
- human approval

이것은 삭제하면 안 된다.

오히려 Marketplace의 핵심 backend가 될 수 있다.

### Rename conceptually

```text
Strategy Factory
→ Method Validation Engine
```

Lifecycle:

```text
Draft
→ Backtest
→ OOS
→ Forward
→ Verified
→ Marketplace
→ Elite / Retired
```

---

## 7.4 Monte Carlo

**Grade: AA**  
**Disposition: KEEP**

`src/trading/monteCarlo.ts`

Method의 robustness 평가에 적합하다.

단, Monte Carlo PASS가 Marketplace 공개의 단독 조건이 되어서는 안 된다.

---

## 7.5 Strategy Experiment Ledger

**Grade: AA-**  
**Disposition: REDESIGN → Method Experiment Ledger**

현재 이미:

- genome
- hypothesis
- development validation
- blind validation
- walk-forward
- stress
- Monte Carlo
- parameter robustness
- score
- lifecycle
- human review

를 저장한다.

새 Marketplace의 **Method Track Record**로 거의 그대로 전환 가능하다.

`hard_gate_passed` 같은 실행 중심 용어는 `qualification_status` 등으로 변경.

---

# 8. Detailed Audit — Council & Experts

## 8.1 24-member Investment Committee

**Grade: A as Expert Library / C as always-on Council**  
**Final Disposition: MERGE into Expert Registry**

`src/trading/investmentCommittee.ts`에는 이미 24개의 역할이 정의되어 있다.

확인된 예:

- Chief Market Strategist
- Sector Rotation PM
- Growth & Quality Analyst
- Value & Re-rating Analyst
- Event & Catalyst Analyst
- News & Evidence Intelligence
- Trend & Momentum PM
- Mean Reversion PM
- Wave & Market Structure Analyst
- Volume & Absorption Analyst
- Microstructure & Execution Analyst
- Foreign & Institutional Flow Analyst
- Factor Quant
- Statistical Signals Researcher
- Regime Quant
- Earnings Revision Analyst
- Capex & Industrial Cycle Analyst
- Macro Rates & FX Strategist
- Policy & Geopolitics Analyst
- Small/Mid-cap Liquidity Analyst
- Portfolio Risk Officer
- Trade Architect
- Model Validation Lead
- Adversarial Red Team

### Decision

**24명을 버리는 게 아니라 Council에서 내려 Expert Marketplace의 seed catalog로 옮긴다.**

즉:

```text
Old: 24 people = Council

New:
6 Core = always available Council
18+ Specialists = Marketplace / invite pool
+ user-created Experts
```

---

## 8.2 Council Constitution / Persona System

**Grade: A+**  
**Disposition: REDESIGN**

현재 좋은 자산:

- persona-level jurisdiction
- required tests
- forbidden inference
- data access
- specialist resolver
- evidence fabrication 금지

이 구성은 사용자 제작 Expert schema의 씨앗이 될 수 있다.

### New Expert schema candidate

- identity / title
- specialty
- market/asset coverage
- horizon
- required inputs
- preferred Methods
- forbidden inference
- dissent style
- output contract
- version
- creator
- validation track record

---

## 8.3 Council Core Engine

**Grade: BBB+**  
**Disposition: REDESIGN**

현재 deterministic Council은 APPROVE/CAUTION/REJECT와 Red Team 결과를 만든다.

새 제품에서는 “execution approval” 대신:

- support
- oppose
- neutral/uncertain
- key arguments
- disagreement
- missing data

가 더 적절하다.

### Target

Report header:

```text
Support 61%
Oppose 39%
```

단, 단순 투표율이 아니라 **각 Expert의 판단을 투명하게 보여주는 summary**여야 한다.

---

## 8.4 Council Debate API

**Grade: A**  
**Disposition: REDESIGN**

`api/council-debate.ts`는 이미:

- independent persona round
- Red Team review
- persona revision
- structured output
- AI cost accounting

을 구현한다.

문제는 마지막에 **Decision Arbiter가 LONG/SHORT/NO_TRADE**를 결정한다는 점이다.

### Keep

- independent initial views
- evidence-grounded prompts
- member revisions
- cost ledger
- structured messages

### Remove

- capital decision arbiter
- execution semantics

### Add

- conversation transcript
- reply-to / disagreement references
- method conflict messages
- invited Expert join event
- final Report synthesis

---

## 8.5 Red Team

**Grade: BBB**  
**Disposition: MERGE**

별도 Red Team pipeline을 항상 돌릴 필요는 없다.

기본 Core 6 중 **Skeptic/Challenger** 역할로 흡수하거나, 높은 불확실성/유료 deep research에서 추가 Expert로 초청할 수 있다.

---

## 8.6 Arbiter

**Grade: D**  
**Disposition: DELETE**

Relevant:
- `src/trading/councilArbiter.ts`
- `server/eventLedgerArbiterProjection.ts`
- Council Debate final arbiter phase

Arbiter는 Council 결과를 다시 ALLOW/REVIEW/BLOCK 또는 LONG/SHORT/NO_TRADE로 압축한다.

새 제품에서는 이 압축이 오히려 정보 손실이다.

**Report synthesis가 필요하지 Arbiter authority는 필요하지 않다.**

Migration 시 과거 Arbiter records는 historical event로 보존한다.

---

## 8.7 Operational AI Council Adjudicator

**Grade: C**  
**Disposition: ARCHIVE**

`server/trading/aiCouncilAdjudicator.ts`

PAPER trade event / deterministic Council contradiction을 검토하는 execution-era 기능이다.

재사용 가능:
- model escalation policy
- structured response handling
- AI usage recording

폐기/보관:
- ENTER/EXIT materiality authority
- PAPER adjudication semantics

---

# 9. Detailed Audit — Forecast & Outcome

## 9.1 Evidence Forecast

**Grade: A-**  
**Disposition: REDESIGN**

현재 bullish/bearish probability를 생성하는 기반이 있다.

새 방향은 한 단계 더 나가야 한다.

Target:
- horizon
- Bull/Base/Bear
- price range/path
- assumptions
- invalidation
- forecast lock

---

## 9.2 Forecast Calibration

**Grade: AAA-**  
**Disposition: REDESIGN / STRENGTHEN**

`server/eventLedgerForecastCalibration.ts`는 이미:

- bullish/bearish probabilities
- realized returns
- direction hit
- Brier-like squared probability error
- absolute probability error
- empirical return distribution
- minimum sample requirement

을 다룬다.

이것은 Marketplace Expert scoring의 핵심 자산이다.

### Extend

새 price-path forecast에:

- range hit
- path deviation
- terminal error
- max adverse deviation
- horizon-specific calibration
- scenario calibration

을 추가한다.

---

## 9.3 Decision Replay

**Grade: AAA**  
**Disposition: REDESIGN / STRENGTHEN**

현재 Decision Replay는 trace/outcome/history/calibration을 묶는다.

새 제품에서는 이름과 UX를 사용자 친화적으로 바꿀 수 있다.

예:

- Oracle History
- Report History
- Forecast Replay

### Chart experience

과거 시점 marker 클릭:

```text
2026-09-11 · price ₩X
Grade AA-
Support 68 / Oppose 32
Forecast path
Experts
Methods
Evidence
→ Open original report
```

현재 Decision Replay의 event lineage가 이 기능의 backend가 된다.

---

# 10. Detailed Audit — Report

## 10.1 Legacy Report

**Grade: BB**  
**Disposition: REPLACE**

현재 `src/store.tsx` / `src/types.ts`에 Firestore-based Report 개념이 존재하지만, modern mobile runtime의 핵심 제품으로 연결되어 있지 않다.

새 Report v2에 필요한 것:

- immutable report version
- instrument
- current price/as-of
- support/oppose
- Expert contributions
- Method results
- method conflict
- Evidence snapshot
- Event context
- Entry consideration zone
- invalidation
- TP1 / TP2
- Bull/Base/Bear forecast
- generatedAt
- evaluationAt
- later outcome

Legacy Report를 확장하는 것보다 **새 schema를 만드는 편이 안전**하다.

---

## 10.2 Trade Map

**Grade: A-**  
**Disposition: MERGE into Report Scenario**

현재 entry / stop / TP1 / TP2 / R:R 정보는 유용하다.

다만 이름과 authority가 문제다.

`TradeMap`을 자동 주문 지도처럼 사용하지 않고:

> **If you consider buying — Scenario Map**

으로 Report에 흡수한다.

---

# 11. Detailed Audit — Risk, Execution, AutoTrade

## 11.1 Deterministic Risk

**Grade: C+ for new product / A for old AutoTrade**  
**Disposition: ARCHIVE + EXTRACT MINIMAL GUARDRAILS**

현재 Risk Engine은:

- per-trade risk
- dynamic protection completeness
- daily loss throttle
- risk budget

등을 계산한다.

AutoTrade를 제거했으므로 더 이상 제품의 중심 판단자가 아니다.

### Preserve as generic safety utility

향후 simulation에서 필요한 최소 guardrail:

- invalid quantity
- invalid price
- stale price
- duplicate action
- max simulated position
- max simulated loss
- kill switch / abort
- data integrity

이 외의 투자 의사결정 risk semantics는 Report/Expert 분석으로 이동.

---

## 11.2 Execution Policy

**Grade: D**  
**Disposition: ARCHIVE**

`src/trading/executionPolicy.ts`는 evidence gate → risk → protection → execution을 연결한다.

AutoTrade 제거 후 새 제품의 active architecture에는 필요 없다.

다만 historical PAPER replay와 simulator regression 때문에 바로 삭제하지 않는다.

---

## 11.3 Position Sizing

**Grade: C**  
**Disposition: ARCHIVE / SIMULATION ONLY**

사용자가 실제 주문을 자동 실행하지 않는 제품에서는 core 기능이 아니다.

Method backtest에서 position sizing sensitivity를 테스트하는 utility로만 유지 가능.

---

## 11.4 PAPER Broker / Portfolio / Protection

**Grade: B/B+**  
**Disposition: ARCHIVE**

삭제 이유가 아니라 **목적을 바꾼다.**

Old:
- AutoTrade execution qualification

New:
- Method simulation
- historical test
- forward/shadow evaluation
- regression fixture

사용자-facing Trade tab은 제거.

---

# 12. Runtime Infrastructure & Railway

## 12.1 Current Fleet

| Service | Grade | Disposition |
| --- | --- | --- |
| `black-oracle-web` | **A** | KEEP, repurpose to new product |
| `black-oracle-paper-vnext` | **B** | FREEZE / ARCHIVE |
| `black-oracle-paper-s2-shadow` | **B** | FREEZE / ARCHIVE |
| `black-oracle-paper-v9-multiasset` | **B-** | ARCHIVE / later decommission |

### Rule

**지금 삭제하지 않는다.**

먼저:
1. writer ownership
2. scheduled jobs
3. historical data dependencies
4. event lineage
5. rollback artifact

를 확인한 뒤, Paper services를 차례로 stop/decommission한다.

AutoTrade를 제품에서 제외했다고 runtime을 즉시 삭제하면 과거 검증 기록과 데이터 생성 lineage를 잃을 수 있다.

---

## 12.2 Runtime Profile / Qualification

**Grade: B**  
**Disposition: ARCHIVE**

현재 vNext qualification을 위한 runtime identity / pinned system revision / risk hash 검증은 매우 정교하지만 새 product surface와 맞지 않는다.

Historical simulation reproducibility에는 가치가 있으므로 archival boundary에 유지.

---

## 12.3 Scheduler

**Grade: B**  
**Disposition: ARCHIVE / REPLACE**

현재 scheduler는 PAPER cycle용이다.

새 스케줄러는 향후:

- Market scan
- Sector scan
- NARS event processing
- Expert discovery
- Forecast evaluation
- Method forward test

로 역할을 바꿔야 한다.

---

# 13. UI / UX Audit

## 13.1 Current Mobile V11.1

**Grade: B+**  
**Disposition: ARCHIVE AS REFERENCE**

현재 navigation:

```text
Command | Markets | Oracle | Trade | Lab
```

문제:

- PAPER qualification이 첫 화면
- strategy/risk/council pipeline 노출
- Trade가 주요 메뉴
- Lab이 Strategy Factory
- 제품보다 시스템 운영 대시보드에 가까움

Target:

```text
Market | Reports | Council | Marketplace | Me
```

따라서 V11.2 식으로 계속 patch하는 것을 중단하고 **새 product shell을 별도 구축**한다.

---

## 13.2 V2–V10 / V11 Legacy Mobile Versions

**Grade: F**  
**Disposition: DELETE after target migration**

`src/mobile/BlackOracleMobileAppV2.tsx`부터 다수의 버전 파일이 동시에 존재한다.

이들은:

- bundle/source navigation 복잡도
- 잘못된 수정 대상 선택 위험
- CSS/UX regressions
- 유지보수 비용

을 만든다.

새 shell이 production parity를 확보한 뒤 삭제한다.

필요한 visual pattern은 docs/design으로 snapshot한다.

---

## 13.3 Data Gap / Last-known-good Wrapper

**Grade: AA**  
**Disposition: KEEP**

`src/mobile/BlackOracleMobileApp.tsx`의 API failure isolation과 last-known-good preservation은 좋은 설계다.

새 UI에서도 유지한다.

---

## 13.4 Desktop Legacy Shell

**Grade: C**  
**Disposition: ARCHIVE INTERNAL**

`src/App.tsx`는:

- Cases
- Hypothesis
- Forecast legacy
- Ledger
- Operations
- Strategies
- Oracle Field

등 internal concepts를 직접 노출한다.

새 consumer product와 분리한다.

필요한 운영 기능은 `/internal` 또는 admin-only surface로 이동.

---

# 14. Legacy Product State & Firebase

## 14.1 Firebase / Firestore Store

**Grade: D**  
**Disposition: DELETE after dependency migration**

`src/store.tsx`는 Firebase/Firestore에:

- sources
- signals
- questions
- hypotheses
- scenarios
- evidence
- predictions
- reports

등을 저장한다.

동시에 modern runtime은 Supabase + APIs를 사용한다.

이는 **두 개의 제품 데이터 세계**를 만든다.

### Decision

새 product state:
- server APIs
- Supabase-backed canonical stores
- client cache/state

로 수렴.

Firebase는 import/reference가 남아 있는 UI를 먼저 제거한 뒤 dependency까지 삭제.

---

## 14.2 Hypothesis / Scenario / Case

**Grade: C**  
**Disposition: MERGE / ARCHIVE**

사용자에게 별도 메뉴로 보여줄 필요는 없다.

좋은 reasoning artifact는 Report 내부의:

- thesis
- bull case
- bear case
- scenario
- what changes mind

로 흡수한다.

---

# 15. AI Cost, Credits, Pricing Foundation

## 15.1 AI Usage Ledger

**Grade: AA+**  
**Disposition: KEEP / EXPAND**

`server/aiUsageLedger.ts`는:

- token usage
- cached input
- output/reasoning
- web search calls
- estimated USD cost
- feature / operation / market context
- monthly budget

을 기록한다.

새 Credits 모델의 실제 원가 회계 기반으로 매우 유용하다.

### Extend

- user_id
- plan
- credit_charge
- expert_id
- method_id
- report_id
- marketplace transaction_id

등을 추가.

**AI API 원가와 사용자 Credit 가격은 분리해서 설계한다.**

---

# 16. Documentation Audit

## 16.1 README

**Grade: C / SUPERSEDED PRODUCT DIRECTION**

현재 README는:

```text
Market → Evidence → Strategies → Router → Council → Arbiter → Risk → Execution
```

및 AutoTrade/Report dual mode를 설명한다.

새 Re-foundation과 직접 충돌하므로 업데이트 필요.

---

## 16.2 Product Constitution v2

**Grade: C / SUPERSEDED**

AutoTrade가 execution-oriented primary plane이라는 헌법적 정의가 새 방향과 충돌한다.

새 Product Constitution v3 필요.

---

## 16.3 Master Sprint Plan v3 / Beta Plan

**Grade: C for target roadmap / A for migration evidence**

AutoTrade sprint sequence는 폐기해야 한다.

하지만 B0에서 확인한:
- source truth
- authority boundary
- rollback
- writer ownership
- deployment revision

자료는 구조조정 안전에 중요하므로 보존한다.

---

# 17. File/Path Disposition Map

이 절은 실제 cleanup PR에서 path-level 작업의 기준이다.

## 17.1 KEEP / REDESIGN — active future

```text
api/market-chart*.ts
api/instrument-cockpit.ts
api/events.ts                  → event/report layer로 재설계
api/decision-replay.ts         → forecast/report replay
api/council-debate.ts          → arbiter 제거 후 Council v2

server/eventLedger*.ts
server/decisionReplay.ts
server/instrumentDecisionLineage.ts
server/aiUsageLedger.ts

server/trading/marketData*
server/trading/equity/*        → research/data providers
server/trading/nars*
server/trading/externalEvidenceSource.ts
server/trading/instrumentAliasRegistry.ts

services/nars/**

src/trading/largeParticipantFootprint*
src/trading/volumeAbsorption*
src/trading/monteCarlo*
src/trading/strategyFactoryBacktest*
src/trading/autonomousStrategyFactory* → Method validation로 개명/재설계
src/trading/marketSectorRuntime*
src/trading/sectorStrengthRuntime*
src/trading/indicators.ts       → optional method utilities
src/trading/marketStructure*
src/trading/volumeProfile*
```

## 17.2 MERGE / REWRITE

```text
src/trading/investmentCommittee.ts
    → Expert Registry seed

src/trading/councilConstitution.ts
    → Expert schema + 6 Core

src/trading/council.ts
    → Council synthesis

src/trading/technicalEvidence.ts
    → Technical Expert core + Method conflict

src/trading/evidenceForecast.ts
    → Forecast Engine

src/trading/tradeMap.ts
    → Report Scenario Map

server/trading/strategyExperimentLedger.ts
    → Method Experiment Ledger

server/trading/strategyFactoryRunner.ts
    → Method Validation Runner
```

## 17.3 ARCHIVE

```text
src/trading/risk.ts
src/trading/executionPolicy.ts
src/trading/positionSizing.ts
src/trading/paperBroker.ts
src/trading/paperPortfolio.ts
src/trading/paperProtection*
src/trading/protectionManager.ts
src/trading/protectionPlan.ts
src/trading/horizonPositionIdentity.ts
src/trading/horizonTradePlan.ts
server/trading/paperLoop.ts
server/trading/paperSession.ts
server/trading/runtimeProfile.ts
server/trading/runtimeLease.ts
server/trading/checkpointPolicy.ts
supabase/functions/black-oracle-native-paper-shadow/**
supabase/functions/black-oracle-paper-scheduler/**
```

Archive means **do not delete until history/simulation dependencies are detached.**

## 17.4 DELETE after dependency proof

```text
src/trading/strategyRouter.ts
src/trading/councilArbiter.ts
Arbiter phase in api/council-debate.ts
Arbiter-specific event projection once historical compatibility path exists

src/mobile/BlackOracleMobileAppV2.tsx
src/mobile/BlackOracleMobileAppV3.tsx
src/mobile/BlackOracleMobileAppV4.tsx
src/mobile/BlackOracleMobileAppV5.tsx
src/mobile/BlackOracleMobileAppV6.tsx
src/mobile/BlackOracleMobileAppV7.tsx
src/mobile/BlackOracleMobileAppV8.tsx
src/mobile/BlackOracleMobileAppV81.tsx
src/mobile/BlackOracleMobileAppV8ScrollFix.tsx
src/mobile/BlackOracleMobileAppV8Swipe.tsx
src/mobile/BlackOracleMobileAppV9.tsx
src/mobile/BlackOracleMobileAppV10.tsx
src/mobile/BlackOracleMobileAppV11.tsx
(current V11_1 only after replacement reaches parity)

Firebase-era product store after all imports removed
legacy consumer views after admin/research features are migrated
```

## 17.5 INVESTIGATE BEFORE DELETE

Root utility files:

```text
clearDb.ts
patch.ts
patch_store.ts
test-rss.ts
test2.ts
```

이름상 cleanup 후보지만 CI/runtime import 및 수동 운영 의존성을 별도 확인하기 전 삭제 금지.

---

# 18. New Build Gap Matrix

현재 코드에서 **충분히 구현되지 않은 새 핵심 제품**이다.

| Capability | Current status | Priority |
| --- | --- | --- |
| Market-first Home | partial/legacy | P0 |
| Favorites / personalized watchlist v2 | legacy only | P0 |
| Report v2 | missing | P0 |
| 6 Core Council v2 | partial foundations | P0 |
| Messenger-style Council transcript | missing | P0 |
| Expert Registry | seed data exists | P0 |
| Expert invitation with Credits | missing | P1 |
| Expert Creator | missing | P1 |
| Marketplace Experts | missing | P1 |
| Method Registry | strategy foundations exist | P1 |
| Method Creator | missing | P1 |
| Method qualification / publication gates | partial validation engine | P1 |
| Forecast immutable snapshot v2 | partial directional forecast | P0 |
| Future price path on chart | missing | P0 |
| Forecast evaluation / track record | partial strong foundation | P0 |
| Report/Forecast chart markers | missing | P0 |
| Expert chart drawing/annotations | missing | P1 |
| Sector Discovery v2 | partial | P1 |
| Anti-popularity-bias candidate generation | missing | P1 |
| Marketplace leagues/seasons | missing | P2 |
| Creator payouts | missing | P2 |
| New Plans/Credits entitlement layer | missing | P1 |

---

# 19. Target Architecture After Audit

```text
                           BLACK ORACLE
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
     MARKET                   ORACLE                MARKETPLACE
       │                        │                        │
 Search / Favorites       6 Core Experts        Experts / Methods
 Market / Sector              + Invite               │
 Asset Detail                  │                Create / Validate
 Chart Layers            Council Debate          Compete / Share
       │                        │                        │
       └─────────────── REPORT v2 ─────────────────────┘
                                │
                           FORECAST LOCK
                                │
                         FUTURE PRICE PATH
                                │
                         OUTCOME / EVALUATION
                                │
                   CANONICAL HISTORY / REPLAY
                                │
                      TRACK RECORD / GRADES

Infrastructure:
Market Data + NARS + Evidence + Event Ledger + Validation + AI Cost
```

**No Router. No Arbiter. No AutoTrade. No user-facing Risk Engine.**

---

# 20. Six Core Council — Audit Recommendation

정확한 prompt/persona는 다음 설계에서 확정하되, 기존 24명 자산을 기준으로 가장 압축력이 높은 6개 역할은 다음이 적합하다.

1. **Market & Macro**
   - regime, rates, FX, liquidity, broad market

2. **Sector & Fundamental**
   - sector position, business, earnings, valuation, cycle

3. **Technical**
   - Price / Volume / MA core + selected Methods

4. **Event & Evidence**
   - NARS, filings, news, catalysts, evidence quality

5. **Flow & Microstructure**
   - volume, large participants, liquidity, institutional/foreign flow, crypto microstructure

6. **Skeptic / Challenger**
   - priced-in risk, counterevidence, crowding, alternative explanation, data gaps

Specialists such as semiconductor, biotech, crypto on-chain, quant/model validation, earnings, policy, commodities 등은 Marketplace Expert로 이동.

---

# 21. The “Priced-in” Problem — Required Product Research

새 BLACK ORACLE이 해결해야 할 핵심 문제는:

> 좋은 뉴스가 있다는 것과 현재 가격에서 좋은 투자 기회라는 것은 다르다.

따라서 Report는 Evidence의 긍정도를 단순히 가격 방향으로 변환하면 안 된다.

필수 분리:

```text
Fundamental/Event quality
≠
Surprise relative to expectations
≠
Current valuation/price
≠
Future return opportunity
```

향후 Forecast/Expert evaluation에서 “뉴스가 맞았나”보다 **당시 가격 이후 실제 forward return을 얼마나 잘 예측했나**를 평가한다.

---

# 22. Migration Sequence

## Wave 0 — Freeze

- AutoTrade 신규 개발 중단
- 기존 PAPER services/data mutation 금지
- old product docs를 historical로 표시
- PR #197 source-of-truth를 새 product governing draft로 사용

## Wave 1 — Product Shell

- New navigation: Market / Reports / Council / Marketplace / Me
- New Market Home
- Favorites
- Asset Detail
- existing market data reuse

## Wave 2 — Report + Forecast

- Report v2 schema
- immutable forecast snapshot
- Bull/Base/Bear path
- forecast evaluation
- chart markers
- replay

## Wave 3 — Council v2

- 6 Core
- Expert Registry
- messenger transcript
- no Arbiter
- support/oppose synthesis
- Method conflict disclosure

## Wave 4 — Marketplace

- Expert profile
- user Expert creator
- Method registry
- Method validation reuse
- qualification gates
- Credits invite

## Wave 5 — NARS/Sector

- event intelligence
- sector discovery
- universe-first candidate generation
- popularity-bias controls

## Wave 6 — Cleanup

- freeze/decommission Paper Railway services
- remove old schedulers
- remove Router/Arbiter
- migrate Firebase dependencies
- delete V2–V11 duplicate UI
- update README / Product Constitution / sprint roadmap

---

# 23. Do Not Delete Yet

다음은 새 방향에서 불필요해 보여도 **현재 즉시 삭제하면 안 되는 것**이다.

- PAPER runtime data
- Canonical event history
- Decision Replay links
- historical Arbiter/Council events
- Strategy experiment records
- Monte Carlo outputs
- current Railway Paper services
- runtime checkpoint tables
- scheduler ownership metadata
- old UI required for production fallback
- Firebase data until migration/export is proven

원칙:

> **Remove authority and routing first; delete historical truth last.**

---

# 24. Immediate Decisions from This Audit

## Confirmed retirement direction

- AutoTrade product — **REMOVE**
- Strategy Router — **DELETE after dependency migration**
- Arbiter — **DELETE**
- separate hard-gate product concept — **REMOVE**
- standalone user-facing Risk Engine — **REMOVE**
- 24-member always-on Council — **REMOVE**
- Strategy Factory as primary product — **REMOVE**
- Lab name/product — **REPLACE WITH MARKETPLACE**
- Trade primary navigation — **REMOVE**
- old AutoTrade-first pricing — **REPLACE**

## Confirmed preservation direction

- Market data truth
- NARS
- Evidence provenance
- Canonical Event Ledger
- Decision Replay
- Forecast calibration
- Method validation infrastructure
- Monte Carlo / OOS / walk-forward
- Volume/large participant analytics
- AI usage/cost ledger
- existing expert definitions as seed catalog

---

# 25. Audit Confidence & Remaining Verification

| Area | Confidence | Note |
| --- | --- | --- |
| GitHub architecture | **High** | main tree + critical files inspected |
| Railway services/config | **High** | live project/service configuration inspected |
| Current product UI architecture | **High** | current mobile entrypoint/V11.1 and desktop shell inspected |
| Trading/Council/Strategy architecture | **High** | critical modules inspected |
| NARS architecture | **High** | service/code/docs/migrations present and consumer path inspected |
| Supabase source schema | **High** | migrations + prior B0 artifacts available |
| Supabase live catalog state | **Low / UNVERIFIED** | live connector query timed out |
| Safe physical DB deletion list | **NOT AUTHORIZED** | live dependency/catalog re-verification required |
| Exact Railway decommission timing | **Medium** | writer/scheduler ownership must be re-probed |

---

# 26. Final Audit Verdict

현재 BLACK ORACLE에서 **가장 먼저 없애야 하는 것은 코드가 아니라 제품의 계층**이다.

### Remove from active architecture

```text
Strategy Router
→ Arbiter
→ Hard Gate
→ standalone Risk
→ AutoTrade execution authority
```

### Keep and elevate

```text
Market
→ NARS / Evidence
→ Experts
→ Council Debate
→ Report
→ Forecast
→ Outcome
→ Replay / Track Record
```

### Convert

```text
Strategy Factory / Lab
→ Method Validation / Marketplace

24-member Council
→ 6 Core + Expert Marketplace

Trade Map
→ Report Scenario Map

Decision Replay
→ Chart-native Oracle History

PAPER simulation
→ hidden Method validation infrastructure
```

이 구조로 가면 BLACK ORACLE은 복잡한 자동매매 엔진을 사용자에게 설명해야 하는 제품에서 벗어나,

> **시장을 보고, 전문가의 토론을 읽고, 분석 Method를 검증하고, 미래 가격 예측을 기록하며, 그 예측을 실제 시장으로 채점하는 투자 리서치 플랫폼**

으로 명확해진다.

---

## Next Document Update

이 감사 결과를 기반으로 `BLACK_ORACLE_REFOUNDATION_2026-09-19.md`를 **v0.2**로 승격하고, 다음 구현 PR의 기준을:

1. Target data model
2. API contract
3. UI information architecture
4. migration/deprecation plan
5. pricing/credits v2

순으로 정의한다.
