# Black Oracle Trading v0.1

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
```

## Liquidity Universe

Black Oracle does not scan every KRW pair equally. The gateway first ranks high-turnover candidates and checks execution quality before a market can become tradable.

v0.1 eligibility gates:

- no exchange warning flag
- 24h KRW turnover >= 1B KRW
- best bid/ask spread <= 25 bps
- minimum of top-5 bid/ask depth >= 5M KRW

Liquidity score weights:

- 45% 24h turnover
- 35% spread quality
- 20% top-5 depth

The universe endpoint currently inspects the highest-turnover 30 KRW markets and returns a ranked shortlist.

## Strategy engines

### Trend

Trend direction is built from price vs EMA20, EMA20 vs EMA50, EMA50 vs EMA200, price vs EMA200, and the regime classifier. It emits a signed score from -100 to +100.

### Momentum

Momentum combines RSI impulse around 50, MACD histogram normalized by ATR, 20-period rate of change, and volume Z-score confirmation. It also emits a signed score from -100 to +100.

### Mean Reversion

RSI is not a direct buy/sell switch. The engine combines RSI, Stoch RSI, and Bollinger %B, then discounts reversal conviction when the market is in a strong continuation trend. `OVERBOUGHT` inside `STRONG_UPTREND` can therefore remain `WAIT` unless reversal-direction confirmation appears.

## Signal Fusion

Weights change by regime.

```text
STRONG TREND   Trend 45 / Momentum 35 / Reversion 10 / Event 10
TREND          Trend 40 / Momentum 30 / Reversion 15 / Event 15
RANGE          Trend 15 / Momentum 20 / Reversion 45 / Event 20
```

Until a structured event score exists, the event weight is redistributed across technical engines instead of injecting a fake neutral AI opinion.

The fused directional score (-100 to +100) is mapped to `Oracle Trade Score` (0 to 100). High-volatility regimes reduce the downstream position-risk multiplier. Directional disagreement across engines reduces confidence and risk budget.

## Multi-timeframe consensus

Black Oracle now evaluates three independent snapshots:

- 4H = 45% authority
- 1H = 35% authority
- 15M = 20% authority

A lower-timeframe burst cannot open a new position when a higher timeframe materially opposes the aggregate direction. Aligned timeframes receive a confidence boost; disagreement reduces position risk.

## Paper Portfolio

The paper layer now keeps real state in memory for the running trading gateway:

- KRW cash
- spot positions
- average cost including entry fee
- realized P&L
- unrealized P&L
- cumulative fees
- marked market value
- equity and peak equity
- drawdown
- daily P&L ratio
- bounded equity curve history

Paper v0.1 does not pyramid into an existing position and cannot short. Sell orders can be quantity-sized so a protective exit closes exactly the existing spot position.

The session is intentionally in-memory at this stage. Restarting the gateway resets it unless the caller explicitly initializes a new cash balance. Durable persistence is a later slice after the accounting contract is stable.

## Deterministic entry / exit

New entry requires all of the following:

1. liquidity eligible
2. multi-timeframe action = BUY
3. multi-timeframe confidence >= 62%
4. higher timeframes do not materially oppose the entry
5. risk gate passes

Position notional is scaled below the 2% hard cap using signal conviction and the multi-timeframe risk multiplier.

Protection is deterministic:

- stop distance = 1.8 x 1H ATR%, bounded to 1.2%–4.0%
- take-profit = 2R
- stop-loss or take-profit triggers immediate Paper exit
- a material multi-timeframe SELL reversal also exits the long spot position

## Hard risk rules

- Spot only in v0.1.
- No leverage, margin, futures, martingale, or grid averaging.
- Maximum requested position notional: 2% of equity.
- Daily loss circuit breaker: -1%.
- Total drawdown circuit breaker: 5%.
- Stale market data, disconnected feed, ledger mismatch, duplicate order, or excessive estimated slippage rejects a trade.
- LLM output never has direct order authority. Intelligence must be converted to structured evidence/forecast data and pass deterministic execution rules.

## Gateway

```bash
npm run dev:trading
```

Default port: `3100` (override with `TRADING_PORT`).

Read routes:

- `GET /health`
- `GET /api/trading/markets`
- `GET /api/trading/universe?limit=12`
- `GET /api/trading/candles?market=KRW-BTC&unit=15&count=200`
- `GET /api/trading/snapshot?market=KRW-BTC&unit=60`
- `GET /api/trading/multitimeframe?market=KRW-BTC`
- `GET /api/trading/paper/state`

Paper mutation routes:

- `POST /api/trading/paper/reset` body `{ "initialCash": 1000000 }`
- `POST /api/trading/paper/step` body `{ "market": "KRW-BTC" }`
- optional `eventScore` can be supplied to snapshot / multi-timeframe / paper step and must remain between -100 and +100

`paper/step` performs one auditable decision iteration: public market data -> liquidity -> 4H/1H/15M intelligence -> execution decision -> optional paper fill -> portfolio accounting -> ledger tail.

No authenticated exchange key, live order route, or withdrawal capability exists in this slice.

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

## Next slice

1. durable Paper Portfolio persistence and session checkpoints
2. scheduled paper loop over the ranked eligible universe
3. structured Oracle event/evidence objects with provenance, decay, expiry, and contradiction handling
4. performance analytics: win rate, expectancy, profit factor, max DD, calibration by signal bucket
5. Trading workspace after accounting/execution contracts stabilize
