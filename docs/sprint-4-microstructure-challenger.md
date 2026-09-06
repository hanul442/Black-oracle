# Sprint 4 — Microstructure & Volume-Profile Challenger

## Purpose

Sprint 4 adds an **observational challenger** to Black Oracle's existing Paper engine. It asks a narrow question:

> If recent executed order flow, displayed order-book depth, and a trade-sample volume profile had been considered at decision time, would ranking quality improve out of sample?

It does **not** assert that displayed depth is latent institutional demand, and it does not grant microstructure features order authority.

## Public data contract

Black Oracle uses Upbit public quotation endpoints only in this sprint.

- Recent trades: `GET /v1/trades/ticks`, up to 500 recent prints per request.
- Trade side: Upbit classifies `BID` as buy and `ASK` as sell using the taker order type.
- Orderbook: `GET /v1/orderbook`, explicitly requesting 30 levels.
- Existing Paper market selection, liquidity gating, and OHLCV ingestion remain unchanged.

Reference:
- https://global-docs.upbit.com/reference/list-pair-trades
- https://global-docs.upbit.com/reference/list-orderbooks
- https://global-docs.upbit.com/docs/faq-order

## Features

### 1. Taker-flow imbalance

For sampled executions:

`(buy quote volume - sell quote volume) / total quote volume`

Quote volume is `trade price × trade volume`.

### 2. Displayed-depth imbalance

The same normalized imbalance is calculated for top-5, top-15, and top-30 bid/ask depth in KRW notional. A proximity-weighted top-30 measure gives nearer levels more influence.

### 3. Trade-sample volume profile

The 500-print sample is placed into price bins using actual executed quote volume. The engine records:

- POC: highest sampled quote-volume bin
- contiguous 70% sampled value area around POC
- high-volume nodes
- low-volume nodes
- current price location relative to sampled value

This is deliberately named a **trade-sample volume profile**. It is not a full-session or exchange-wide historical volume profile unless the sample actually spans that horizon.

### 4. Shadow pressure score

A transparent heuristic combines executed taker imbalance and displayed-depth imbalance. The score is bounded to `[-100, 100]` and labelled bullish / bearish / neutral.

This score is **not calibrated edge**. It exists to create an auditable challenger variable that can later be tested against realized Paper outcomes.

### 5. Shadow Oracle score

The baseline Oracle score is preserved. Sprint 4 additionally records a bounded shadow adjustment and classifies the challenger as:

- `SUPPORTS`
- `CONFLICTS`
- `NEUTRAL`
- `UNAVAILABLE`

No branch of the Sprint 4 code is allowed to alter entry, exit, position sizing, stop placement, or portfolio limits.

## Failure semantics

Microstructure ingestion is optional and fail-soft. If recent trades or the orderbook cannot be retrieved, the challenger becomes `UNAVAILABLE`; the existing Paper decision path continues unchanged.

## Validation plan

Closed Paper trades are bucketed by challenger alignment. Promotion is prohibited until Black Oracle can compare baseline and challenger on unseen outcomes, including at minimum:

- expectancy and average return
- win rate and payoff ratio
- drawdown impact
- fee/slippage sensitivity
- regime stability
- sample sufficiency
- parameter stability
- Monte Carlo survival

Any later execution authority requires a separate sprint, explicit Hard Gates, and a versioned Champion–Challenger promotion decision.

## Research rationale

The design is motivated by market-microstructure literature showing that order-flow imbalance can contain short-horizon price-impact information, while keeping the empirical claim separate from Black Oracle's own crypto validation. A canonical reference is Cont, Kukanov & Stoikov, *The Price Impact of Order Book Events* (2010/2014). Black Oracle must still establish incremental edge on its own market, data source, fees, horizons, and execution model.
