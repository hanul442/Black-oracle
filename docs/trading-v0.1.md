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
               Oracle Trade Score
                0 ---- 50 ---- 100
               SELL   WAIT      BUY
                       |
                       v
              Deterministic Risk Gate
                       |
                       v
              Paper Broker -> Ledger
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

Momentum combines:

- RSI impulse around 50
- MACD histogram normalized by ATR
- 20-period rate of change (ROC20)
- volume Z-score confirmation

It also emits a signed score from -100 to +100.

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

The fused directional score (-100 to +100) is mapped to `Oracle Trade Score` (0 to 100):

- 0 = strongest sell-side technical conviction
- 50 = neutral / wait
- 100 = strongest buy-side technical conviction

High-volatility regimes reduce the downstream position-risk multiplier to 0.5. Directional disagreement across engines also reduces confidence and risk budget.

## Hard risk rules

- Spot only in v0.1.
- No leverage, margin, futures, martingale, or grid averaging.
- Maximum requested position notional: 2% of equity.
- Daily loss circuit breaker: -1%.
- Total drawdown circuit breaker: 5%.
- Stale market data, disconnected feed, ledger mismatch, duplicate order, or excessive estimated slippage rejects a trade.
- LLM output never has direct order authority. Intelligence must be converted to structured evidence/forecast data and pass deterministic execution rules.

## Public-data gateway

```bash
npm run dev:trading
```

Default port: `3100` (override with `TRADING_PORT`).

Routes:

- `GET /health`
- `GET /api/trading/markets`
- `GET /api/trading/universe?limit=12`
- `GET /api/trading/candles?market=KRW-BTC&unit=15&count=200`
- `GET /api/trading/snapshot?market=KRW-BTC&unit=60`
- `GET /api/trading/snapshot?market=KRW-BTC&unit=60&eventScore=30`

`eventScore` is optional and reserved for structured Oracle evidence. It accepts -100 to +100 and never bypasses the deterministic risk layer.

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

1. Persist paper cash, positions, realized/unrealized P&L, fees, and equity curve.
2. Add deterministic entry/exit policy and risk-sized Paper orders.
3. Add multi-timeframe 4H / 1H / 15M consensus.
4. Add structured Oracle event/evidence score with expiry and provenance.
5. Add a Trading workspace only after execution and ledger contracts stabilize.
