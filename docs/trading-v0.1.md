# Black Oracle Trading v0.1

## Goal

Build a safe, auditable crypto trading foundation around the existing Black Oracle intelligence product without rewriting the current Oracle Field / Cases / Forecasts / Council / Ledger experience.

The first-month success criterion is engineering safety and a verifiable Paper -> Approval Live -> conditional Auto Live path, not a guaranteed return target.

## v0.1 architecture

```text
Upbit public market data
        |
        v
Indicator Engine
EMA / RSI / Stoch RSI / ATR / MACD / Bollinger / Volume Z
        |
        v
Regime Engine
Strong Up / Up / Range / Down / Strong Down + volatility flag
        |
        v
Mean Reversion Engine
Overbought / Oversold, trend-aware
        |
        v
Signal Fusion (next slice)
        |
        v
Deterministic Risk Gate
        |
        v
Paper Broker -> Execution Ledger
```

## Hard risk rules

- Spot only in v0.1.
- No leverage, margin, futures, martingale, or grid averaging.
- Maximum requested position notional: 2% of equity.
- Daily loss circuit breaker: -1%.
- Total drawdown circuit breaker: 5%.
- Stale market data, disconnected feed, ledger mismatch, duplicate order, or excessive estimated slippage rejects a trade.
- LLM output never has direct order authority. Intelligence must be converted to structured evidence/forecast data and pass deterministic execution rules.

## Overbought / oversold rule

RSI is not a direct buy/sell switch. The mean-reversion engine combines RSI, Stoch RSI, and Bollinger %B and then discounts the score when the market regime is a strong continuation trend. An overbought reading inside a strong uptrend is therefore allowed to remain `WAIT` unless reversal-direction confirmation appears.

## Public-data gateway

A standalone gateway is intentionally isolated from the legacy server during the first foundation slice.

```bash
npm run dev:trading
```

Default port: `3100` (override with `TRADING_PORT`).

Routes:

- `GET /health`
- `GET /api/trading/markets`
- `GET /api/trading/candles?market=KRW-BTC&unit=15&count=200`
- `GET /api/trading/snapshot?market=KRW-BTC&unit=60`

The snapshot endpoint fetches 200 Upbit minute candles, computes the indicator set, classifies the regime, and emits a regime-aware overbought/oversold signal.

## Validation

```bash
npm run lint
npm run test:trading
npm run build
```

A network smoke check can additionally run the Upbit public-data path:

```bash
npx tsx scripts/trading-smoke.ts KRW-BTC
```

## Next slice

1. Add liquidity/spread filters and a ranked KRW market universe.
2. Add trend and momentum strategy scores.
3. Add Signal Fusion and explicit expected-value fields.
4. Persist paper orders/fills/positions into an append-only trading ledger.
5. Add a Trading workspace to the V2 interface only after the backend contracts stabilize.
