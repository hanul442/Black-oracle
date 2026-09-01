# Black Oracle Trading v0.1.4

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
                       |
                       v
            Atomic Runtime Checkpoint
       Session / Evidence / Loop / Trade Journal
                       |
                       v
              Restart Recovery + Health
```

## Liquidity Universe

Black Oracle does not scan every KRW pair equally. It ranks high-turnover candidates and checks execution quality before a market can become tradable.

v0.1 eligibility gates:

- no exchange warning flag
- 24h KRW turnover >= 1B KRW
- best bid/ask spread <= 25 bps
- minimum of top-5 bid/ask depth >= 5M KRW

The loop scans a conservative shortlist rather than every listed asset.

## Strategy stack

### Trend

Price vs EMA20, EMA20 vs EMA50, EMA50 vs EMA200, price vs EMA200, and regime structure emit a signed trend score from -100 to +100.

### Momentum

RSI impulse, MACD histogram normalized by ATR, ROC20, and volume Z-score emit a signed momentum score from -100 to +100.

### Mean Reversion

RSI is not a direct buy/sell switch. RSI, Stoch RSI, and Bollinger %B are combined and then discounted when a strong trend can keep price extended. `OVERBOUGHT` in a strong uptrend can remain `WAIT`.

### Structured Evidence

Trading evidence is represented as explicit objects instead of an untraceable LLM opinion.

Each item records market, claim, direction, strength, reliability, source type/provenance, observed time, expiry, optional contradiction link, and tags. Active evidence is aggregated into a -100 to +100 event score after reliability, expiry decay, and contradiction handling.

If no active evidence exists, Event weight is redistributed to technical engines. LLM/event evidence never receives direct order authority.

## Multi-timeframe consensus

Black Oracle evaluates:

- 4H = 45% authority
- 1H = 35% authority
- 15M = 20% authority

A lower-timeframe burst cannot open a new position when a higher timeframe materially opposes the aggregate direction. Alignment increases confidence; disagreement reduces downstream risk.

## Paper Portfolio

The Paper account tracks:

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

New entry requires eligible liquidity, BUY multi-timeframe consensus, confidence >= 62%, no material higher-timeframe opposition, and deterministic Risk Gate PASS.

Position notional is conviction-scaled and always capped by the 2% account-equity hard limit.

Protection:

- stop distance = 1.8 x 1H ATR%, bounded to 1.2%-4.0%
- take-profit = 2R
- stop-loss, take-profit, or material MTF SELL reversal can close a long spot position

## Continuous Paper Loop

Default configuration:

- interval: 15 minutes
- minimum allowed interval: 5 minutes
- maximum ranked new candidates per cycle: 6
- maximum simultaneous Paper positions: 4
- currently open positions remain monitored even if they leave the top-liquidity shortlist
- markets are processed sequentially with a small spacing delay

The loop can resume after a process restart when its checkpoint says it was running and `TRADING_RESUME_LOOP` is not set to `false`.

## Performance analytics

Closed Paper trades feed:

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
- maximum and current drawdown
- performance buckets by entry Oracle Trade Score: 50-59, 60-69, 70-79, 80-89, 90-100

These metrics are used to decide whether a measurable edge exists before any Approval Live transition.

## Durable checkpoint and restart recovery

v0.1.4 adds versioned runtime checkpoints. The default store is:

```text
.data/black-oracle-trading-state.json
```

The path can be overridden with `TRADING_STATE_FILE`.

Each checkpoint contains:

- Paper Portfolio internal accounting state
- open positions and protective levels
- mark prices
- entry metadata needed for closed-trade attribution
- closed-trade journal
- Trading Ledger
- processed Paper order IDs
- all structured Evidence, including expired history
- Paper loop configuration, running intent, cycle count, and last-cycle summary

Writes are serialized and use a temporary file followed by atomic rename. The file is created with owner-only permissions where supported. Mutating API calls checkpoint immediately, while a periodic autosave provides additional recovery coverage. Graceful SIGINT/SIGTERM shutdown also writes a final checkpoint.

On startup the Trading gateway restores the checkpoint before opening HTTP routes. Corrupt or unsupported checkpoint data fails closed instead of silently replacing trading state with a fresh account.

### Persistence boundary

The default JSON checkpoint survives **process restarts only when the deployment filesystem itself is persistent**. Container-local disks on platforms such as ephemeral Cloud Run instances may be replaced during redeploy/cold-start migration. For unattended production observation, `TRADING_STATE_FILE` must point to a persistent mounted volume, or this checkpoint interface should be moved to a remote datastore such as PostgreSQL / Supabase / Firestore before any Live phase.

## Runtime health

`/health` and `/api/trading/runtime/health` now expose operational state rather than a static OK response.

Health includes:

- process uptime
- persistence path, last save, last restore, and persistence fault
- autosave state
- loop running state and cycle count
- last cycle completion time and error count
- stale-loop detection when a running loop misses more than 2.5 configured intervals
- account equity / cash / open positions
- daily loss and drawdown status
- risk-lock state
- basic performance metrics

The endpoint returns HTTP 503 when persistence is faulted or a running loop is stale.

## Hard risk rules

- Spot only in v0.1.
- No leverage, margin, futures, martingale, grid averaging, pyramiding, or shorting.
- Maximum requested position notional: 2% of equity.
- Daily loss circuit breaker: -1%.
- Total drawdown circuit breaker: 5%.
- Continuous Paper loop caps simultaneous positions.
- Stale market data, disconnected feed, ledger mismatch, duplicate order, or excessive estimated slippage rejects a trade.
- LLM output never has direct order authority.
- No authenticated exchange key, live order route, or withdrawal capability exists in v0.1.4.

## Gateway

```bash
npm run dev:trading
```

Environment:

```text
TRADING_PORT=3100
TRADING_STATE_FILE=.data/black-oracle-trading-state.json
TRADING_AUTOSAVE_MS=60000
TRADING_RESUME_LOOP=true
```

Runtime / persistence:

- `GET /health`
- `GET /api/trading/runtime/health`
- `GET /api/trading/runtime/persistence`
- `POST /api/trading/runtime/checkpoint`

Market intelligence:

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
- `POST /api/trading/paper/reset`
- `POST /api/trading/paper/step`

Paper loop:

- `GET /api/trading/paper/loop/status`
- `POST /api/trading/paper/loop/start`
- `POST /api/trading/paper/loop/stop`
- `POST /api/trading/paper/loop/cycle`

## Validation

```bash
npm run lint
npm run test:trading
npm run build
```

Trading tests now include persistence-file roundtrip, missing-checkpoint behavior, Paper Portfolio restore, Ledger restore, and Evidence restore in addition to strategy/risk/accounting tests.

## Next slice

1. deploy the Paper gateway onto storage that survives host replacement, or migrate the checkpoint adapter to a remote database
2. run unattended Paper observation and collect operational / performance history
3. add ingestion adapters from Black Oracle Case / News / Council into structured Evidence
4. add attribution by regime, evidence state, signal component, and exit reason
5. build the Trading workspace UI after persistence and accounting contracts stabilize
