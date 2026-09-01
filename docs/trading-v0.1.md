# Black Oracle Trading v0.1.5

## Goal

Build a safe, auditable crypto trading foundation around the existing Black Oracle intelligence product without rewriting the current Oracle Field / Cases / Forecasts / Council / Ledger experience.

The first-month success criterion is engineering safety and a verifiable Paper -> Approval Live -> conditional Auto Live path, not a guaranteed return target.

## Current architecture

```text
Upbit public market data
        |
        +---- Ticker / Orderbook ----> Liquidity Universe
        +---- 4H / 1H / 15M candles
        |
        v
Indicators -> Regime -> Trend / Momentum / Mean Reversion
        |
Structured Evidence
        |
        v
Regime-weighted Fusion -> Oracle Trade Score
        |
4H / 1H / 15M Consensus
        |
Deterministic Entry / Exit -> Risk Gate <= 2%
        |
Paper Broker -> Paper Portfolio -> Closed Trades / Performance
        |
Continuous Paper Universe Loop
        |
Versioned Runtime Checkpoint
        |
  +-----+------------------+
  |                        |
Local atomic JSON      Supabase/Postgres
(dev / fallback)       (durable remote)
  |                        |
  +-----------+------------+
              |
        Restart Recovery
              |
          Runtime Health
```

## Strategy and risk summary

- Spot only; no shorting, leverage, margin, futures, martingale, grid averaging, or pyramiding.
- Maximum requested position notional: 2% of equity.
- Daily loss circuit breaker: -1%.
- Total drawdown circuit breaker: 5%.
- Entry requires eligible liquidity, BUY MTF consensus, confidence >= 62%, no material higher-timeframe opposition, and deterministic Risk Gate PASS.
- Stop distance = 1.8 x 1H ATR%, bounded to 1.2%-4.0%; take-profit = 2R.
- RSI is not a direct trigger. RSI / Stoch RSI / Bollinger extremes are regime-aware, so overbought in a strong uptrend can remain WAIT.
- Structured Evidence is bounded, expires/decays, supports contradictions, and never has direct order authority.

## Continuous Paper Loop

Default configuration:

- interval: 15 minutes
- minimum allowed interval: 5 minutes
- maximum ranked new candidates per cycle: 6
- maximum simultaneous Paper positions: 4
- currently open positions remain monitored even if they leave the top-liquidity shortlist

The loop can resume after restart when its checkpoint says it was running and `TRADING_RESUME_LOOP` is not `false`.

## Performance analytics

Closed Paper trades feed trade count, wins/losses, win rate, gross/net P&L, expectancy, average win/loss, payoff ratio, profit factor, total return, max/current drawdown, and entry Oracle Trade Score buckets (50-59 through 90-100).

These metrics are used to decide whether a measurable edge exists before Approval Live.

## Persistence and restart recovery

The persistence layer has a common `TradingCheckpointStore` contract and two implementations.

### Local JSON

Default development backend:

```text
TRADING_PERSISTENCE_BACKEND=json
TRADING_STATE_FILE=.data/black-oracle-trading-state.json
```

Writes are serialized and use temp-file -> atomic rename. This survives process restart only if the host filesystem survives.

### Supabase / Postgres

Remote durable backend:

```text
TRADING_PERSISTENCE_BACKEND=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server secret>
TRADING_RUNTIME_ID=black-oracle-paper
```

The server uses the Supabase REST endpoint with the **service-role key only on the server**. Never expose this key in Vite/client code.

Schema migration:

```text
supabase/migrations/202609010001_black_oracle_trading_runtime.sql
```

The table is `public.black_oracle_trading_runtime`, keyed by `runtime_id`. It stores the complete versioned checkpoint as JSONB plus schema version, save timestamp, and reason.

Security boundary:

- RLS is enabled.
- `anon` and `authenticated` receive no table privileges.
- only `service_role` is granted server-side access.
- no permissive client RLS policy is created intentionally.

A missing row is treated as a fresh Paper account. Corrupt or unsupported checkpoint data fails closed rather than silently resetting an existing runtime.

## Checkpoint contents

Each checkpoint contains:

- Paper Portfolio accounting state
- open positions / stop / take-profit
- mark prices
- entry metadata for trade attribution
- closed-trade journal
- Trading Ledger
- processed Paper order IDs
- structured Evidence, including expired history
- Paper loop configuration, running intent, cycle count, and last-cycle summary

Mutating API calls checkpoint immediately; periodic autosave adds recovery coverage; graceful SIGINT/SIGTERM shutdown writes a final checkpoint.

## Runtime health

`/health` and `/api/trading/runtime/health` report:

- strategy version and uptime
- active persistence backend/location
- save/restore counts and last persistence fault
- autosave / restore state
- loop cadence, cycle count, stale-loop detection, last-cycle errors
- equity, cash, positions, daily P&L, drawdown, risk lock
- trades, win rate, expectancy, profit factor, max drawdown

A persistence fault or stale running loop degrades health.

## Gateway routes

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

Paper account / loop:

- `GET /api/trading/paper/state`
- `GET /api/trading/paper/performance`
- `POST /api/trading/paper/reset`
- `POST /api/trading/paper/step`
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

Trading tests include strategy/risk/accounting tests, JSON checkpoint recovery, and mocked Supabase upsert/load behavior including service-role headers and missing-runtime handling.

## Remaining deployment boundary

Remote persistence removes the host-disk state-loss problem, but the **Trading gateway itself still needs an always-on host** to run the 15-minute in-process Paper loop continuously. The Supabase database does not keep this Node process alive.

Before Approval Live:

1. deploy the Paper gateway to an always-on/appropriately scheduled runtime
2. inject `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server secrets
3. start the Paper loop and observe it unattended for multiple days
4. inspect operational faults + expectancy / profit factor / max DD / calibration
5. only then design Approval Live exchange authentication and order reconciliation
