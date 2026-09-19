# BLACK ORACLE Re-foundation — Product Source of Truth

> **Status:** DRAFT v0.1  
> **Date:** 2026-09-19  
> **Purpose:** BLACK ORACLE의 제품 정체성, 구조조정 기준, 신규 사용자 경험, Council/Expert/Method/Marketplace/Forecast 방향을 고정하기 위한 기준 문서.  
> **Rule:** 이 문서의 `CONFIRMED` 항목은 이후 설계·개발의 기본 기준으로 사용한다. 기존 구현과 충돌할 경우 즉시 삭제하지 않고 Audit에서 KEEP / REDESIGN / MERGE / ARCHIVE / DELETE 판정을 내린 뒤 변경한다.

---

## 0. Executive Summary

BLACK ORACLE은 기존의 복잡한 자동매매 중심 의사결정 파이프라인에서 벗어나 다음 방향으로 재정의한다.

**시장 탐색 → 전문가 분석 → Council 토론 → Report → Chart/Forecast → 사후 검증 → Marketplace 경쟁**

제품의 전면에는 사용자가 이해하기 쉬운 **Market / Reports / Council / Marketplace / Me**를 둔다.

기존 `Strategy Factory → Router → Council → Arbiter → Hard Gate → Risk → Execution` 형태의 다단계 구조는 전면 재감사한다. 자동매매는 현재 제품 방향에서 제외하고, 필요한 시뮬레이션·검증 인프라만 보존한다.

BLACK ORACLE의 핵심 차별점은 다음 네 가지다.

1. **6인 Core Council + 필요 시 추가 Expert 초청**
2. **전문가와 분석 Method를 사용자도 만들고 검증해 Marketplace에서 경쟁**
3. **AI의 미래 가격 예측을 차트에 기록하고 시간이 지난 뒤 실제 결과로 평가**
4. **Report·판단·예측의 과거 기록을 차트 위에서 재생·검증**

---

# 1. Product Re-definition

## 1.1 New Product Identity — CONFIRMED

BLACK ORACLE은 자동매매 프로그램이 아니라 **AI 투자 리서치·분석 플랫폼**을 우선한다.

핵심 질문은 다음과 같다.

- 지금 시장에서 무엇이 일어나고 있는가?
- 어떤 섹터·종목·자산이 관찰할 가치가 있는가?
- 서로 다른 전문가들은 왜 찬성/반대하는가?
- 현재 가격에 좋은 뉴스가 이미 선반영된 것은 아닌가?
- AI가 과거에 내린 판단과 미래 가격 예측은 실제로 맞았는가?
- 어떤 Expert/Method가 장기적으로 신뢰할 만한가?

## 1.2 Product Philosophy — CONFIRMED

BLACK ORACLE은 “무엇을 사라”고 단정하는 제품보다 다음을 보여주는 방향을 우선한다.

- 찬성/반대 비율
- 찬성 근거
- 반대 근거
- 예상 시나리오
- 진입 고려 구간
- 무효화/손절 구간
- TP1 / TP2
- 미래 예상 가격 범위
- 당시 사용한 Evidence
- 참여한 Expert
- 사용한 Technical Method
- 이후 실제 결과

---

# 2. Top-level Information Architecture

## 2.1 Primary Navigation — CONFIRMED DIRECTION

```text
Market | Reports | Council | Marketplace | Me
```

기존의 Strategy, Router, Arbiter, Ledger 등 내부 시스템 용어는 일반 사용자 전면 Navigation에 노출하지 않는다.

## 2.2 Product Layers

```text
MARKET
├─ Search
├─ Favorites
├─ Korea
├─ US
├─ Crypto
├─ ETF
├─ Sector
└─ Asset Detail / Chart

REPORTS
├─ Latest
├─ Popular
├─ Favorites
├─ Sector
├─ Expert Reports
└─ Search

COUNCIL
├─ 6 Core Experts
├─ Debate
├─ Evidence
├─ Method Conflict
└─ + Invite Expert [Credits]

MARKETPLACE
├─ Experts
│  ├─ Official
│  ├─ Community
│  ├─ My Experts
│  └─ Creator Studio
└─ Methods
   ├─ Official
   ├─ Community
   ├─ My Methods
   └─ Experimental / Validation

ME
├─ Watchlist
├─ Saved Reports
├─ My Experts
├─ My Methods
├─ Credits / Plan
└─ Track Record
```

---

# 3. Home / Market Experience

## 3.1 Home Direction — CONFIRMED

첫 화면은 AI 대시보드보다 **정상적인 투자 앱처럼 종목을 탐색하는 경험**을 우선한다.

권장 구성:

1. Search
2. Favorites / Watchlist
3. Market tabs: Korea / US / Crypto / ETF
4. 종목 리스트
5. Latest Reports
6. Expert Discoveries
7. Trending / Emerging Sectors

각 종목 행에는 과도한 정보를 넣지 않는다.

예시:

```text
SK hynix
₩XXX,XXX   +1.6%
Oracle Report · 3h
★
```

## 3.2 Asset Detail — CONFIRMED DIRECTION

종목을 클릭하면 기본적으로 Chart를 본다.

권장 secondary tabs:

```text
Chart | Oracle | News | Financials
```

Report가 존재하면 차트에서 `Oracle Report Available` 상태를 표시한다.

---

# 4. Chart as the Main Analysis Surface

## 4.1 Chart Layers — CONFIRMED DIRECTION

차트에는 다음 레이어를 선택적으로 켤 수 있게 한다.

- Price / Candles
- Volume
- Moving Average
- Technical Analysis
- Oracle Report markers
- Council Grade markers
- NARS / Event markers
- Forecast paths
- Support / Resistance
- Entry / Invalidation / TP1 / TP2

## 4.2 Technical Drawing — CONFIRMED DIRECTION

Technical Analyst가 텍스트만 출력하지 않고 가능한 경우 차트 위에 직접 분석을 표현한다.

예:

- 추세선
- 지지/저항
- 거래량 급증 지점
- 가격 압축 구간
- Breakout / Failed breakout
- Liquidity zone
- FVG / Order Block 등 검증 대상 Method의 시각적 결과
- Entry zone
- Stop / invalidation
- TP1 / TP2

단, 특정 방법론을 진리로 취급하지 않는다. 각 Method는 검증 가능한 하나의 분석 도구다.

---

# 5. Technical Analysis Re-design

## 5.1 Core Technical Inputs — CONFIRMED

Technical Analysis의 기본은 다음 세 요소를 우선한다.

1. **Price**
2. **Volume**
3. **Moving Average**

기타 지표는 보조 수단으로 사용한다.

목표는 indicator를 많이 쌓는 것이 아니라 가격·거래량·구조를 명확히 읽는 것이다.

## 5.2 Small-cap / Crypto Emphasis — CONFIRMED DIRECTION

소형주와 Crypto는 시장 참여자의 영향력이 상대적으로 강할 수 있으므로 거래량 구조를 더 중요하게 다룬다.

관찰 후보:

- 비정상 거래량
- 가격 압축
- 급락 이후 거래량 회복
- accumulation / distribution 후보
- liquidity sweep
- breakout / failure
- 변동성 변화

## 5.3 Multi-Method Conflict — CONFIRMED

한 Technical Analyst가 여러 Method를 사용할 수 있다.

예:

```text
Volume + MA       → 긍정
Price Action      → 중립
Breakout          → 조건 미충족
Volume Profile    → 상단 매물 부담
```

이 결과를 강제로 평균내어 하나의 신호로 만들지 않는다.

Council 토론에서 반드시 다음처럼 충돌을 설명한다.

> 거래량과 이동평균 기준으로는 개선되고 있으나, Breakout Method에서는 확인 신호가 아직 없고 상단 매물대 부담이 남아 있습니다.

## 5.4 ICT-style Methods — CANDIDATE / TERM TO VERIFY

사용자가 언급한 “IT Trading”은 ICT(Inner Circle Trader) 계열 방법론일 가능성이 있으나 용어를 최종 확인하기 전까지 확정하지 않는다.

검토 후보:

- Market Structure
- Liquidity
- Liquidity Sweep
- Fair Value Gap
- Order Block
- Breaker
- Displacement
- Premium / Discount

이들도 하나의 Marketplace Method로 취급하고 과거·Forward 성과로 검증한다.

---

# 6. Council v2

## 6.1 6 Core Experts — CONFIRMED

기존 24인 Council을 그대로 유지하지 않는다.

기본 Council은 **6명의 Core Expert**로 축소한다.

정확한 페르소나와 역할은 별도 재설계한다.

현재 후보 역할:

- Macro / Market
- Fundamental
- Technical
- Event / Catalyst
- Sector / Industry
- Skeptic / Challenger

## 6.2 Expert Expansion — CONFIRMED

필요한 경우 사용자가 Credits를 사용해 추가 전문가를 Council에 초대할 수 있다.

예:

- Semiconductor Specialist
- Biotech Specialist
- Small-cap Flow Specialist
- Crypto Microstructure Expert
- On-chain Analyst
- Korea Equity Specialist
- US Tech Specialist
- Earnings Analyst
- Quant Analyst
- Commodity Analyst

## 6.3 Council UI — CONFIRMED DIRECTION

Council 토론은 표·점수판만 보여주는 것이 아니라 **메신저/단체 대화방처럼 읽히는 UI**를 우선 검토한다.

각 메시지는 최소한 다음을 가져야 한다.

- Expert identity
- Claim
- Evidence reference
- Method reference if relevant
- Confidence / uncertainty
- Bull / Bear / Neutral stance
- Time

전문가 간 의견 충돌을 숨기지 않는다.

---

# 7. Expert System

## 7.1 Expert Types — CONFIRMED

- Official Expert
- Community Expert
- Custom / Private Expert
- Sector Specialist
- Asset-class Specialist
- Technical Specialist

## 7.2 User-created Experts — CONFIRMED

사용자는 자신의 Expert를 만들 수 있다.

구성 가능한 요소 후보:

- 전문 시장
- 전문 섹터
- 전문 자산군
- 투자 시간축
- 선호 Method
- 리스크 성향
- Evidence 우선순위
- 반론 강도
- 금지 조건
- 보고 스타일

예:

```text
Korean Small-Cap Hunter
Market: KOSDAQ small caps
Core: Volume + MA
Optional: Price Action / Volume Profile
Horizon: 2 weeks–3 months
Bias: aggressive
Focus: deep drawdown + abnormal volume recovery
```

## 7.3 Expert Discovery — CONFIRMED

Expert가 직접 시장을 탐색하고 종목을 발견하는 기능을 둔다.

무료 사용자는:

- 종목명
- 간단한 발견 이유

까지 볼 수 있다.

상세 Thesis / Report / Council participation은 Credits 또는 Plan에 따라 제한한다.

---

# 8. Marketplace v2

## 8.1 Lab → Marketplace — CONFIRMED

기존 `Lab` 명칭은 사용자 제품 면에서 `Marketplace`로 재편한다.

Marketplace는 두 축이다.

```text
Marketplace
├─ Experts
└─ Methods
```

검증 인프라는 내부적으로 계속 존재할 수 있으나 사용자는 Marketplace에서 검증 결과와 등급을 본다.

## 8.2 Expert vs Method — CONFIRMED

Expert와 Method는 별도의 평가 대상을 가진다.

### Expert
판단·분석의 품질을 평가한다.

예:
- Report track record
- Forecast calibration
- Direction hit
- Range hit
- Sector discovery quality
- Risk identification
- Evidence quality
- User reputation

### Method
통계적/시장 성능을 평가한다.

예:
- OOS
- Expected return
- MDD
- Hit rate
- Sample size
- Regime robustness
- Parameter robustness
- Forward performance

Expert Grade와 Method Grade는 같은 의미로 해석하지 않는다.

---

# 9. Marketplace Gamification & Competition

## 9.1 Core Principle — CONFIRMED

게임화는 단순 XP·출석·장식용 뱃지가 아니라 **검증과 성과를 통과해야 승격되는 경쟁 시스템**으로 설계한다.

## 9.2 Expert Lifecycle — DIRECTION

```text
Private
  ↓
Candidate
  ↓
Verified
  ↓
Marketplace
  ↓
Elite
```

공개 조건 후보:

- 최소 Report 수
- 최소 Forecast 수
- 최소 평가 기간
- Forecast calibration threshold
- Evidence integrity
- 일정 Grade 이상
- 중대한 규칙 위반 없음

## 9.3 Method Lifecycle — DIRECTION

```text
Draft
  ↓
Backtest
  ↓
OOS
  ↓
Forward Test
  ↓
Verified
  ↓
Marketplace
  ↓
Elite / Retired
```

## 9.4 Competition — DIRECTION

- Expert League
- Method League
- Monthly season
- Quarterly season
- Korea / US / Crypto league
- Sector league
- Horizon league: 1W / 1M / 3M etc.
- Official vs Community
- Promotion / Demotion
- Retirement / comeback

## 9.5 Anti-gaming Requirements — REQUIRED

랭킹은 단순 수익률이나 적중률만으로 정하지 않는다.

필요 후보:

- Minimum sample
- Time-weighting
- Calibration
- Drawdown
- Coverage
- Regime diversity
- Data leakage prevention
- Survivorship-bias prevention
- Forecast lock
- Versioned Method / Expert
- 공개 후 임의 수정 방지

---

# 10. Forecast Engine

## 10.1 Future Price Paths — CONFIRMED

Report 작성 시 미래 가격에 대한 예상 경로 또는 범위를 차트의 미래 구간에 표시한다.

단일 목표가보다 다음 형태를 우선 검토한다.

- Bull
- Base
- Bear

각 시나리오에:

- Price range
- Horizon
- Probability / confidence if calibrated
- Key assumptions
- Invalidation conditions

를 연결한다.

## 10.2 Forecast Lock — REQUIRED

Forecast 생성 시 다음을 고정한다.

- timestamp
- current price
- horizon
- expected range/path
- expert
- report version
- evidence snapshot
- method snapshot

미래 결과를 본 뒤 과거 예측을 조용히 수정할 수 없게 한다.

## 10.3 Forecast Review — CONFIRMED

Horizon이 지나면 실제 가격과 비교해 자동 평가한다.

예:

```text
Forecast: ₩195k–215k
Actual:   ₩207k
Result:   Within expected range
```

장기적으로 Expert Marketplace의 Track Record에 연결한다.

---

# 11. Report v2

## 11.1 Report Conclusion — CONFIRMED

Report의 핵심 결론은 단순 BUY / SELL보다 다음을 우선한다.

```text
매수를 고려한다면

찬성 61%
반대 39%
```

그리고:

### Bull case
- ...

### Bear case
- ...

### Technical conflict
- ...

### Scenario
- Entry consideration
- Invalidation / Stop
- Future expected range
- TP1
- TP2

## 11.2 Report is Research, not Execution — CONFIRMED

Report는 거래를 자동으로 실행하는 관문이 아니다.

사용자가 판단하기 위한 독립적인 리서치 결과물이다.

---

# 12. NARS / Event Intelligence

## 12.1 NARS Role — CONFIRMED DIRECTION

NARS는 단순 뉴스 수집기가 아니라 Event Intelligence Layer로 발전시킨다.

입력 후보:

- News
- Filings
- Earnings
- Policy
- Macro events
- Corporate events
- Industry events

각 Event를:

```text
Market → Sector → Company / Asset
```

에 연결한다.

## 12.2 Sector Discovery — CONFIRMED DIRECTION

개별 종목 추천 전에:

```text
Market → Sector → Asset
```

Top-down 탐색을 지원한다.

Sector 평가 후보:

- Price trend
- Earnings momentum
- Capital flow
- Event momentum
- Valuation
- Macro sensitivity

## 12.3 Popularity Bias Problem — REQUIRED FIX

웹 기사량 또는 검색 노출량이 많은 섹터가 투자기회로 과대평가되는 문제를 방지한다.

특히 AI/반도체처럼 기사량이 많은 영역에서:

```text
News popularity ≠ Investment attractiveness
```

를 시스템 설계 원칙으로 둔다.

Universe/시장 데이터 기반 후보 생성과 Evidence 검색 순서를 분리하는 방안을 감사·설계한다.

---

# 13. AutoTrade Decision

## 13.1 AutoTrade — CONFIRMED REMOVE FROM CURRENT PRODUCT DIRECTION

AutoTrade는 현재 개편 방향에서 제품 기능으로 진행하지 않는다.

이 결정으로 다음 계층을 전면 재감사한다.

- Strategy Router
- Arbiter
- Hard Gate
- standalone Risk Engine
- Execution orchestration
- Broker integration
- Position sizing pipeline

## 13.2 Preserve Simulation Infrastructure — CONFIRMED

자동매매 제품을 제거한다고 해서 검증 인프라까지 없애지 않는다.

보존 가치가 있는 후보:

- Paper / Simulation
- Historical backtest
- Forward test
- Outcome
- Forecast evaluation
- Method validation
- Replay
- Experiment history

이는 Marketplace Expert/Method 검증에 재사용한다.

---

# 14. Minimum Safety Infrastructure

## 14.1 Principle — CONFIRMED

향후 주문·시뮬레이션 실행 계층이 존재하더라도 복잡한 “Hard Gate 제품”으로 노출하지 않는다.

최소 안전장치만 인프라 수준에서 유지한다.

후보:

- invalid quantity
- stale price
- duplicate order
- max position
- max loss
- kill switch
- invalid instrument
- data integrity check

실제 존치 범위는 코드 감사 후 결정한다.

---

# 15. Monetization Direction

## 15.1 Confirmed Usage Rules

### Core Council
- 6명의 Core Expert는 기본 제공
- 상세 토론 / 전체 Report / 빈도에는 Plan별 사용량 제한을 둘 수 있음

### Expert Discovery
- 종목명 + 간단한 발견 이유는 공개
- 전체 분석 / 상세 Report / 추가 토론은 Credits 또는 유료 Plan

### Invite Expert
- Credits 기반 추가 Expert 초청

## 15.2 Monetization Units — CONFIRMED DIRECTION

AutoTrade를 과금축으로 삼지 않는다.

향후 과금 단위 후보:

- Report
- Deep Report
- Expert Invitation
- Premium Expert Report
- Expert Discovery
- Deep Council
- Forecast
- Marketplace Expert
- Marketplace Method
- Advanced historical track record

## 15.3 Plans — RE-DESIGN REQUIRED

기존 요금제는 AutoTrade 제거에 따라 전면 재설계한다.

현재 이름 후보는 별도 문서에서 재검토:

- CORE
- PLUS
- PRO
- MAX
- ENTERPRISE

추가 Credits만 늘리는 `Pro+` / Credit Booster 모델도 검토한다.

Creator 수익배분, Marketplace 수수료, 유료 Expert/Method 판매정책은 미확정이다.

---

# 16. Current Architecture Audit — REQUIRED BEFORE DELETION

현재 구현된 모든 주요 기능을 다음 등급체계로 전수감사한다.

## 16.1 Grade

| Grade | Meaning | Default action |
|---|---|---|
| AAA | 제품 정체성의 핵심 | KEEP / STRENGTHEN |
| AA | 강한 경쟁력 | KEEP |
| A | 유용, 개선 필요 | REDESIGN |
| BBB | 조건부 가치 / 중복 가능 | MERGE |
| BB | 비용 대비 가치 낮음 | DEPRECATE |
| B 이하 | 구조 복잡도 증가 | ARCHIVE / DELETE candidate |
| D / F | 현 방향과 충돌 | DELETE candidate |

## 16.2 Evaluation Dimensions

각 기능을 다음 기준으로 평가한다.

- User value
- Investment research contribution
- Differentiation
- Explainability
- Duplication
- Complexity
- Maintenance burden
- Data dependency
- Scalability
- Marketplace relevance
- Forecast/validation relevance
- Future optionality

## 16.3 Required Disposition

모든 대상은 아래 중 하나로 판정한다.

- KEEP
- REDESIGN
- MERGE
- ARCHIVE
- DELETE

**주의:** 이 문서 작성 시점에서는 Router / Arbiter / Hard Gate / Risk / Strategy Factory 등을 실제 삭제하지 않는다. GitHub 코드·DB·runtime 의존성을 확인한 뒤 처리한다.

---

# 17. Audit Candidate List

우선 전수감사 대상으로 올릴 항목:

- Strategy Factory
- Strategy Router
- Champion–Challenger
- Arbiter
- Red Team
- Hard Gate
- Risk Engine
- Position sizing
- AutoTrade
- Paper Trading
- Execution
- Outcome
- Canonical Ledger
- Decision Replay
- Evidence Store
- NARS
- Council 24
- Council UI
- Report
- Forecast
- Hypothesis
- Scenario
- Case
- Market Dashboard
- Market Detail
- Instrument / Universe
- Sector layer
- Technical indicators
- Monte Carlo validation
- ML Lab
- Experiment Ledger
- Grade System
- Strategy / Method registry
- User Portfolio / Holdings
- Watchlist / Favorites
- Credits / Billing
- Existing plan gating
- Railway runtime jobs
- Supabase tables and lineage
- Legacy UI routes

---

# 18. Source-of-Truth Rules

이후 구현 시:

1. 새 기능을 추가하기 전에 이 문서와 일치하는지 확인한다.
2. 기존 기능이 새 방향과 충돌하면 즉시 삭제하지 않고 Audit 판정을 먼저 받는다.
3. 사용자에게 노출되는 기능명과 내부 엔진명을 구분한다.
4. Expert / Method / Forecast는 versioned record로 남긴다.
5. 과거 예측과 결과를 hindsight로 수정하지 않는다.
6. 성과가 검증되지 않은 Method를 “효과적인 전략”으로 표현하지 않는다.
7. Marketplace 공개는 최소 검증 기준을 통과한 항목만 허용한다.
8. Gamification이 검증 품질보다 우선하지 않는다.
9. Report와 Council은 의견 충돌과 불확실성을 숨기지 않는다.
10. AutoTrade는 현재 제품 로드맵에서 제외한다.

---

# 19. Next Work Order

## Phase A — Current-state Audit
GitHub / Railway / DB / docs / UI를 전수 확인하고 각 기능을 AAA–F로 평가한다.

산출물:
- Full feature inventory
- Grade
- KEEP / REDESIGN / MERGE / ARCHIVE / DELETE
- Dependency map
- Deletion risk
- Migration requirement

## Phase B — Target Architecture
Audit 결과를 반영해 최종 구조를 확정한다.

핵심:
- Market
- Reports
- Council v2
- Expert system
- Method system
- Marketplace
- Forecast
- NARS / Sector
- Validation

## Phase C — Pricing v2
AutoTrade 없는 새 제품 기준으로 요금제·Credits·Marketplace 경제를 설계한다.

## Phase D — UX / UI Specification
Mobile-first 기준으로 다음을 설계한다.

- Home / Market
- Asset Detail / Chart
- Report
- Council chat
- Expert profile
- Method profile
- Marketplace
- Creator Studio
- Forecast replay
- Me / Billing

## Phase E — Implementation
기존 runtime과 데이터를 보호하면서 단계적으로 migration한다.

---

# 20. Open Decisions

다음은 아직 별도 확정이 필요하다.

- Core 6 Expert의 정확한 역할과 persona
- Expert 생성 UI와 prompt/config schema
- Method 생성 범위: no-code / code / template
- Marketplace 공개 최소 기준
- League / season scoring
- Expert Grade 공식
- Method Grade 공식
- Forecast evaluation metric
- Forecast probability calibration 방식
- Creator revenue share
- Marketplace fee
- 새 요금제 가격
- Credits 단가
- Report 생성 비용
- Expert invitation 비용
- Community moderation
- chart vendor / implementation
- NARS external API
- sector universe
- “IT Trading”이 ICT를 의미하는지 최종 확인

---

## Final Target

BLACK ORACLE의 최종 제품 경험은 다음 문장으로 설명할 수 있어야 한다.

> **시장을 탐색하고, 검증 가능한 AI 전문가들이 서로 다른 방법으로 분석하고 토론하며, 그 판단과 미래 가격 예측을 차트에 기록하고 실제 시장 결과로 계속 평가하는 투자 리서치 플랫폼.**

전문가와 Method는 사용자가 직접 만들 수 있고, 검증 조건을 통과하면 Marketplace에서 다른 사용자와 경쟁하고 공유할 수 있다.

이 문서는 2026-09-19 Re-foundation의 기준본이며, 다음 단계인 Current-state Audit 결과에 따라 v0.2로 갱신한다.
