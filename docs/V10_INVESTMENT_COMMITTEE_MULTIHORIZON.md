# BLACK ORACLE V10 — Investment Committee + Multi-Horizon Architecture

## 1. Objective

V10 adds a shadow-first investment-decision layer above the existing S1R2 Paper qualification runtime. It must not contaminate the current qualification sample, change existing live Paper position identity, or grant execution authority to Council agents.

The target cycle is:

1. News / research / filings / official data ingestion
2. Market-state analysis
3. Short-, medium-, and long-horizon bullish-sector selection
4. KRX hard universe filter
5. Expanded Council member nominations
6. Cross-review and scoring
7. Debate
8. Red Team falsification
9. Head Council report and bottom-70% cut
10. Horizon-specific price scenario and trade map
11. Risk / execution decision
12. Trade outcome review
13. Strategy and member-performance update
14. Repeat

## 2. Non-negotiable safety boundaries

- Existing S1R2 Paper runtime remains the production qualification runtime until separately promoted.
- V10 Committee is `mode=SHADOW`, `executionAuthority=false`.
- No Council member can place, size, modify, or cancel an order.
- Missing market cap, crypto-exposure classification, required timeframe, or forecast data is `DATA_GAP`, never an implicit pass.
- `NO_TRADE` is a first-class output.
- Legacy retirement is never automatic.
- Same-market multi-horizon execution is not activated until a qualified migration replaces the current market-keyed Paper position model.

## 3. Market → sector → equity funnel

### Market state

Market state must be horizon aware. The same session can be risk-on intraday while neutral or bearish on a weekly/monthly basis. The system therefore records separate state evidence rather than collapsing everything into one label.

Required inputs should expand toward:

- KOSPI / KOSDAQ index structure
- breadth
- realized / implied volatility when available
- rates and curve
- KRW / USD and cross-asset risk transmission
- liquidity / turnover
- NARS evidence and official releases

### Sector strength

Sector strength is scored independently per horizon using:

- relative strength
- breadth
- volume participation
- source-backed Evidence
- earnings / fundamental momentum when available
- explicit risk penalty

`score >= 62` is the current shadow threshold for a bullish sector to enter the stock-selection funnel. This is a configuration decision, not a production trading threshold.

### KRX hard gate

A KRX candidate must satisfy all of the following before Council nomination is accepted:

- daily volume >= 500,000 shares
- market capitalization >= KRW 100,000,000,000
- not classified as a crypto-linked equity
- no suspension / explicit market warning flag

Missing market-cap or crypto-exposure classification blocks the candidate. The system must add a reliable market-cap and company-exposure provider before this filter can be considered operational.

## 4. Expanded Investment Committee

V10 defines 24 specialist seats. Each seat has:

- an explicit persona
- strategy families
- preferred horizons
- focus signals
- target nomination count between 20 and 100
- optional veto domain

The roster covers market regime, sector rotation, growth / quality, value, catalysts, NARS Evidence, trend / momentum, mean reversion, wave / market structure, volume absorption, microstructure, foreign / institutional flow, factor quant, statistical signals, regime quant, earnings revisions, capex cycle, macro rates / FX, policy / geopolitics, small/mid-cap liquidity, portfolio risk, trade architecture, model validation and adversarial research.

### Nomination protocol

Each member independently emits structured nominations:

- market
- horizon
- rank
- thesis
- strategy ID
- score
- Evidence IDs
- signal IDs
- data gaps

Another member's opinion is never Evidence.

### Cross review

For each nominated market × horizon pair, reviewers independently provide:

- score
- confidence
- support
- objections
- data gaps
- hard-reject flag

Head Council aggregation is not majority voting. It combines cross-review scores with nomination support, penalizes dissent and data gaps, applies hard vetoes first, and only then ranks candidates.

### Head Council cut

Current shadow rule:

- hard veto first
- minimum 3 cross reviews
- rank eligible candidates by final score
- retain top 30%
- bottom 70% cut

This percentage is configurable and must be calibrated from Paper evidence before production use.

## 5. Five independent trading horizons

V10 supports simultaneous:

- Ultra-short
- Short
- Medium
- Medium-long
- Long

Each horizon owns its own:

- thesis
- strategy ID
- evidence freshness requirements
- timeframe authority
- entry
- structural invalidation
- stop
- TP1
- TP2
- final target
- expected holding period
- outcome attribution

The same stock can therefore be long-term bullish while being a short-term `NO_TRADE`, or vice versa.

## 6. Canonical timeframe family

The target canonical frames are:

- 1 minute
- 5 minute
- 15 minute
- 1 hour
- 4 hour
- daily
- weekly
- monthly

Timeframes are not given equal authority. Horizon policies define required frames and weights.

Examples:

- Ultra-short: 5M / 15M / 1H required; 4H contextual
- Short: 1H / 4H / 1D required
- Medium: 1D / 1W required
- Medium-long: 1D / 1W / 1MO required
- Long: 1W / 1MO required

The aggregation module can derive 5M/15M/1H/4H from supplied minute history and 1W/1MO from daily history. It never fabricates missing frames.

### Current data limitation

The existing KIS minute implementation is current-session oriented. It is sufficient for entry timing but not yet a robust multi-day 1H/4H historical source. A deeper intraday provider or persisted minute-candle store is required before V10 can claim complete 1H/4H history for KRX.

## 7. Large-participant footprint (“세력”) policy

The system must not infer a specific actor from volume alone.

V10 therefore records a `Large Participant Footprint` proxy using observable behaviour:

- abnormal volume ratio
- volume expansion persistence
- close location within the candle
- absorption-like high-volume / small-body behaviour
- breakout / breakdown participation
- price-volume divergence
- VWAP / volume-profile context when supplied by the calling layer

Outputs are behavioural states such as accumulation-like, distribution-like, mixed or none. `actorIdentity` remains null unless independent foreign / institution / broker / ownership data supports attribution.

This prevents unsupported claims of manipulation or a specific “세력”.

## 8. Horizon price scenario and trade plan

After Head Council survival, each candidate receives a horizon-specific contract containing:

- current price
- expected price
- expected low / high range
- bullish / bearish / neutral probabilities
- Evidence IDs
- model IDs
- assumptions
- data gaps
- entry
- structural invalidation
- stop
- TP1
- TP2
- final target
- risk/reward

A long trade cannot become an executable candidate when required forecast, stop, target, or structural invalidation fields are missing.

## 9. Same-symbol multi-horizon position identity

The existing S1R2 Paper model is market keyed. That cannot safely represent simultaneous positions such as:

- `KRX-000660 / ULTRA_SHORT / strategy-A`
- `KRX-000660 / MEDIUM / strategy-B`
- `KRX-000660 / LONG / strategy-C`

V10 introduces a shadow identity:

`market::horizon::strategyId`

Example:

`KRX-000660::MEDIUM::sector-momentum-v2`

This is not yet wired into the existing Paper execution runtime. Migration requires separate qualification, replay compatibility, risk-ledger changes and rollback criteria.

## 10. Shared-capital risk

All horizons still consume the same shared capital. Horizon sleeves therefore require explicit gross-exposure and single-position caps.

No default allocation is hard-coded in V10 because capital allocation is a portfolio-policy decision. The validator only enforces:

- each sleeve cap is valid
- single-position cap <= sleeve gross cap
- total horizon gross caps <= shared capital unless leverage is explicitly approved

## 11. UI V10

The mobile app now routes through a V10 shell while preserving the V9 application.

A floating `Cycle` entry opens a dedicated Investment Cycle view showing:

- the full decision flow
- KRX hard gate
- 5-horizon strategy map
- 8-timeframe authority matrix
- large-participant footprint rules
- 24-member Committee roster

This keeps the existing V9 operational UI intact while V10 runtime integration is developed behind it.

## 12. Next runtime integration sequence

Recommended next implementation order:

1. Market-cap / company-exposure data provider
2. Sector taxonomy and live sector-strength packet
3. Persisted KRX intraday history for robust 1H / 4H frames
4. Structured Committee nomination endpoint
5. Cross-review / debate / Red Team endpoint
6. Head Council report persistence
7. Canonical Event Ledger event names for MARKET_STATE, SECTOR, NOMINATION, CROSS_REVIEW, HEAD_COUNCIL and HORIZON_PLAN
8. V10 live status projection into the UI
9. Horizon shadow position book
10. Outcome attribution by horizon / strategy / member
11. Paper evidence collection
12. Separate promotion review before any execution authority changes
