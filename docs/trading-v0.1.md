# Black Oracle Trading v0.1.6

## Goal

Build a safe, auditable crypto trading foundation around the existing Black Oracle intelligence product without rewriting the current Oracle Field / Cases / Forecasts / Council / Ledger experience.

The first-month success criterion is engineering safety and a verifiable Paper -> Approval Live -> conditional Auto Live path, not a guaranteed return target.

## Current architecture

```text
Upbit public market data
        |
        v
Liquidity + 4H / 1H / 15M intelligence
        |
Regime / Trend / Momentum / Mean Reversion / Evidence
        |
Oracle Trade Score + MTF Consensus
        |
Deterministic Entry / Exit -> Risk Gate <= 2%
        |
Paper Broker -> Portfolio -> Closed Trades -> Performance
        |
Versioned Runtime Checkpoint
        |
        v
Supabase durable state
        ^
        |
Scheduled single-cycle worker
(Vercel Cron or another authenticated scheduler)
        |
Distributed Supabase lease
        |
restore -> one Paper cycle -> checkpoint -> exit
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

## Performance analytics

Closed Paper trades feed trade count, wins/losses, win rate, gross/net P&L, expectancy, average win/loss, payoff ratio, profit factor, total return, max/current drawdown, and entry Oracle Trade Score buckets (50-59 through 90-100).

These metrics are used to decide whether a measurable edge exists before Approval Live.

## Persistence and restart recovery

The persistence layer has a common `TradingCheckpointStore` contract and two implementations.

### Local JSON

Development/fallback backend:

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

Schema migrations:

```text
supabase/migrations/202609010001_black_oracle_trading_runtime.sql
supabase/migrations/202609010002_black_oracle_trading_cycle_lease.sql
```

`public.black_oracle_trading_runtime` stores the complete versioned checkpoint as JSONB keyed by `runtime_id`.

Security boundary:

- RLS is enabled.
- `anon`, `authenticated`, and `PUBLIC` receive no table privileges.
- only `service_role` gets server-side access.
- the service-role key must never be exposed in Vite/client code.
- missing runtime row = fresh Paper account; malformed/unsupported checkpoint fails closed.

## Scheduled serverless Paper cycles

v0.1.6 no longer requires a permanently alive `setInterval` process for unattended Paper observation. A scheduled worker can execute exactly one cycle and exit:

```text
Cron request
   |
Bearer CRON_SECRET validation
   |
Supabase distributed lease
   |
Restore checkpoint
   |
Run one ranked Paper universe cycle
   |
Persist checkpoint
   |
Release lease
   |
Function exits
```

Vercel handler:

```text
GET /api/trading-paper-cycle
```

`vercel.json` declares a 15-minute schedule and a bounded function duration. `CRON_SECRET` protects the endpoint using the Authorization header supplied by Vercel Cron.

Required server environment for scheduled mode:

```text
TRADING_PERSISTENCE_BACKEND=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server secret>
TRADING_RUNTIME_ID=black-oracle-paper
CRON_SECRET=<long random server secret>
```

The scheduled endpoint refuses to run when persistence is not Supabase, so an ephemeral serverless invocation cannot silently fall back to local disk.

### Distributed cycle lease

A scheduled call can overlap because of retries, latency, or manual invocation. `black_oracle_trading_cycle_leases` prevents two workers from mutating the same Paper runtime concurrently.

The server-only RPCs are:

```text
claim_black_oracle_trading_cycle_lease
release_black_oracle_trading_cycle_lease
```

The default lease is 840 seconds. A second owner receives `false` while an active lease exists, causing the scheduled worker to skip rather than double-process a cycle. Lease access is service-role only.

## Checkpoint contents

Each checkpoint contains Paper Portfolio accounting, open positions/protection, mark prices, entry metadata, closed trades, Ledger, processed Paper order IDs, structured Evidence, and loop/cycle state. This is enough for the next stateless scheduled invocation to resume from the prior cycle.

## Runtime health

`/health` and `/api/trading/runtime/health` report strategy version, active persistence backend/location, save/restore counts and faults, loop/cycle telemetry, equity/cash/positions, daily P&L/drawdown/risk lock, and core performance metrics.

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

Paper account / in-process loop:

- `GET /api/trading/paper/state`
- `GET /api/trading/paper/performance`
- `POST /api/trading/paper/reset`
- `POST /api/trading/paper/step`
- `GET /api/trading/paper/loop/status`
- `POST /api/trading/paper/loop/start`
- `POST /api/trading/paper/loop/stop`
- `POST /api/trading/paper/loop/cycle`

Scheduled serverless worker:

- `GET /api/trading-paper-cycle` (Bearer `CRON_SECRET` required)

## Validation

```bash
npm run lint
npm run test:trading
npm run build
```

Trading tests cover strategy/risk/accounting, local checkpoint recovery, mocked Supabase upsert/load, and restart primitives. The Supabase lease SQL has also been smoke-tested for acquire, competing-owner rejection, and release behavior.

## Deployment boundary

The code path for scheduled 24/7 Paper observation is now implemented, but it is not considered operational until a production deployment has:

1. the GitHub branch deployed as a Vercel project or equivalent function host
2. Supabase and cron secrets configured server-side
3. the scheduler activated at an allowed cadence
4. a successful authenticated cycle observed in runtime logs
5. subsequent Supabase checkpoint timestamps proving repeated persistence

Only after multi-day Paper data exists should Approval Live authentication/order reconciliation be added.
