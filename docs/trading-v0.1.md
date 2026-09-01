# Black Oracle Trading v0.1.3

## Goal

Build a safe, auditable crypto trading foundation around the existing Black Oracle intelligence product without rewriting the current Oracle Field / Cases / Forecasts / Council / Ledger experience.

The first-month success criterion is engineering safety and a verifiable Paper -> Approval Live -> conditional Auto Live path, not a guaranteed return target.

## Current architecture

```text
Upbit public market data
        |
        +---- Ticker / Orderbook ----> Liquidity Universe
        |                              turnover / spread / top-5 depth
        |
        +---- 4H candles
        +---- 1H candles
        +---- 15M candles
        |
        v
Indicator Engine
EMA / RSI / Stoch RSI / ATR / MACD / ROC / Bollinger / Volume Z
        |
        v
Regime Engine
Strong Up / Up / Range / Down / Strong Down + volatility flag
        |
        +--------------+---------------+
        |              |               |
        v              v               v
Trend Engine     Momentum Engine   Mean Reversion
EMA structure    ROC/MACD/RSI      RSI/Stoch/BB
        |              |               |
        +--------------+---------------+
                       |
              Structured Evidence
      provenance / reliability / expiry / contradiction
                       |
                       v
              Regime-weighted Fusion
                       |
                       v
             Per-timeframe Oracle Score
                       |
                       v
       4H / 1H / 15M Consensus (45/35/20)
                       |
                       v
              Deterministic Entry/Exit
                       |
                       v
                 Risk Gate <= 2%
                       |
                       v
         Paper Broker -> Paper Portfolio
                       |
                       v
      Cash / Position / P&L / Equity Curve / Ledger
                       |
                       v
        Continuous Paper Universe Loop
                       |
                       v
     Win Rate / Expectancy / Profit Factor / Max DD
```

## Liquidity Universe

Black Oracle does not scan every KRW pair equally. It ranks high-turnover candidates and checks execution quality before a market can become tradable.

v0.1 eligibility gates:

- no exchange warning flag
- 24h KRW turnover >= 1B KRW
- best bid/ask spread <= 25 bps
- minimum of top-5 bid/ask depth >= 5M KRW

The loop currently scans a conservative shortlist rather than every listed asset.

## Strategy stack

### Trend

Price vs EMA20, EMA20 vs EMA50, EMA50 vs EMA200, price vs EMA200, and regime structure emit a signed trend score from -100 to +100.

### Momentum

RSI impulse, MACD histogram normalized by ATR, ROC20, and volume Z-score emit a signed momentum score from -100 to +100.

### Mean Reversion

RSI is not a direct buy/sell switch. RSI, Stoch RSI, and Bollinger %B are combined and then discounted when a strong trend can keep price extended. `OVERBOUGHT` in a strong uptrend can remain `WAIT`.

### Structured Evidence

Trading evidence is now represented as explicit objects instead of an untraceable LLM opinion.

Each item records:

- market
- title / claim
- bullish, bearish, or neutral direction
- strength 0-100
- reliability 0-1
- source type and optional provenance
- observed timestamp
- expiry timestamp
- optional `contradictionOf` link
- tags

Active evidence is aggregated into a -100 to +100 event score. Reliability and remaining lifetime reduce or amplify contribution. If newer evidence explicitly contradicts an earlier item, the superseded item's weight is suppressed instead of simply allowing both claims to count equally.

If no active evidence exists, the Event allocation is redistributed to the technical engines. A manually supplied event score remains possible only as an explicit override for testing.

## Multi-timeframe consensus

Black Oracle evaluates:

- 4H = 45% authority
- 1H = 35% authority
- 15M = 20% authority

A lower-timeframe burst cannot open a new position when a higher timeframe materially opposes the aggregate direction. Alignment increases confidence; disagreement reduces downstream risk.

## Paper Portfolio

The running gateway keeps an in-memory paper account with:

- KRW cash
- spot positions
- average cost including entry fee
- realized and unrealized P&L
- cumulative fees
- marked market value
- equity and peak equity
- current drawdown
- daily P&L ratio
- bounded equity curve history
- closed-trade journal

Paper v0.1 cannot short and does not pyramid into an existing position.

## Deterministic entry / exit

New entry requires:

1. eligible liquidity
2. multi-timeframe action = BUY
3. multi-timeframe confidence >= 62%
4. no material higher-timeframe opposition
5. deterministic risk gate PASS

Position notional is conviction-scaled and always capped by the 2% account-equity hard limit.

Protection:

- stop distance = 1.8 x 1H ATR%, bounded to 1.2%-4.0%
- take-profit = 2R
- stop-loss, take-profit, or material MTF SELL reversal can close a long spot position

## Continuous Paper Loop

The Paper loop can be started explicitly and never starts live trading.

Default loop configuration:

- interval: 15 minutes
- minimum allowed interval: 5 minutes
- maximum ranked new candidates per cycle: 6
- maximum simultaneous Paper positions: 4
- existing positions are monitored even when they drop out of the current top-liquidity shortlist
- markets are processed sequentially with a small spacing delay to avoid bursty public-API use

Each loop cycle:

```text
Rank liquidity universe
        |
        v
Include currently open positions
        |
        v
Resolve active structured evidence per market
        |
        v
4H / 1H / 15M analysis
        |
        v
Entry / Hold / Exit decision
        |
        v
Paper fill + portfolio accounting + ledger
        |
        v
Performance snapshot
```

## Performance analytics

Closed Paper trades now feed a performance layer that calculates:

- trade count
- wins / losses / breakeven
- win rate
- gross profit / gross loss
- net P&L
- expectancy per trade
- average win / average loss
- payoff ratio
- profit factor
- average trade return
- total account return
- maximum drawdown from the equity curve
- current drawdown
- performance buckets by entry Oracle Trade Score: 50-59, 60-69, 70-79, 80-89, 90-100

These metrics are intended to determine whether the strategy has an observable edge before any Approval Live or Auto Live transition.

## Hard risk rules

- Spot only in v0.1.
- No leverage, margin, futures, martingale, grid averaging, or shorting.
- Maximum requested position notional: 2% of equity.
- Daily loss circuit breaker: -1%.
- Total drawdown circuit breaker: 5%.
- Continuous Paper loop also caps simultaneous positions.
- Stale market data, disconnected feed, ledger mismatch, duplicate order, or excessive estimated slippage rejects a trade.
- LLM output never has direct order authority.
- No authenticated exchange key, live order route, or withdrawal capability exists in v0.1.3.

## Gateway routes

```bash
npm run dev:trading
```

Market intelligence:

- `GET /health`
- `GET /api/trading/markets`
- `GET /api/trading/universe?limit=12`
- `GET /api/trading/candles?market=KRW-BTC&unit=15&count=200`
- `GET /api/trading/snapshot?market=KRW-BTC&unit=60`
- `GET /api/trading/multitimeframe?market=KRW-BTC`

Evidence:

- `GET /api/trading/evidence?market=KRW-BTC`
- `POST /api/trading/evidence`
- `DELETE /api/trading/evidence/:id`
- `POST /api/trading/evidence/clear`

Paper account:

- `GET /api/trading/paper/state`
- `GET /api/trading/paper/performance`
- `POST /api/trading/paper/reset` body `{ "initialCash": 1000000 }`
- `POST /api/trading/paper/step` body `{ "market": "KRW-BTC" }`

Paper loop:

- `GET /api/trading/paper/loop/status`
- `POST /api/trading/paper/loop/start`
- `POST /api/trading/paper/loop/stop`
- `POST /api/trading/paper/loop/cycle`

Example loop start body:

```json
{
  "intervalMinutes": 15,
  "maxMarkets": 6,
  "maxOpenPositions": 4,
  "runImmediately": true
}
```

Example evidence body:

```json
{
  "market": "KRW-BTC",
  "title": "ETF flow acceleration",
  "direction": "BULLISH",
  "strength": 75,
  "reliability": 0.8,
  "sourceType": "NEWS",
  "source": "example-source",
  "expiresAt": 1788253200000,
  "tags": ["ETF", "flows"]
}
```

## Validation

```bash
npm run lint
npm run test:trading
npm run build
```

Network smoke check:

```bash
npm run smoke:trading -- KRW-BTC
```

## Current persistence boundary

Paper account state, evidence, loop status, and closed-trade analytics are currently process-memory state. A gateway restart resets them. Durable checkpoints are intentionally the next infrastructure slice so persistence is added after the accounting and evidence contracts are stable.

## Next slice

1. durable Paper checkpoints / restart recovery
2. unattended Paper run observation and runtime health metrics
3. richer Evidence ingestion from Black Oracle Case / News / Council outputs
4. calibration and attribution by regime, signal engine, evidence state, and exit reason
5. Trading workspace UI after execution and persistence contracts stabilize
