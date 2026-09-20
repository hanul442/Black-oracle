# BLACK ORACLE BOT

**Auditable automated trading engine for strategy validation, deterministic risk, controlled execution, and decision replay.**

BLACK ORACLE BOT (BOT) is the execution-oriented product in the BLACK ORACLE project family. It is intentionally separated from BLACK ORACLE REPORT so trading authority, runtime state, strategy qualification, broker integration, and risk controls remain isolated from research/report generation.

> **Market → Strategy → Validation → Decision → Risk → Execution → Outcome → Replay**

## Alpha v0.1

**Target:** 2026-10-20

Alpha v0.1 is successful when BOT can run a safe, replayable end-to-end trading loop in PAPER / LIVE_SHADOW with deterministic risk controls and complete lineage.

### Alpha scope

- Upbit KRW market universe and Market Scanner
- Strategy Factory / Strategy Registry
- Backtest / OOS / Walk-Forward / Monte Carlo validation
- Execution-cost and slippage stress
- Champion–Challenger lifecycle
- Strategy Router with first-class `NO_TRADE`
- Trading Council / Red Team / Arbiter in controlled authority modes
- Deterministic Risk Engine
- PAPER and LIVE_SHADOW
- LIVE_CANARY readiness only after explicit qualification
- Upbit adapter, order dry-run, reconciliation, kill switch
- Canonical event ledger
- Outcome attribution
- Decision Replay

### Safety boundary

- Unrestricted `LIVE` is blocked for Alpha.
- AI/Council cannot bypass deterministic Risk.
- Broker secrets must never reach frontend or agent prompts.
- Stale, invalid, or restricted market data fails closed.
- Historical lineage is append-only; newer policy must not rewrite old decisions.
- Existing working PAPER behavior must be preserved while separation is completed.

## Current foundation

The independent BOT repository already contains the migrated trading foundation through BOT-A06:

| Slice | Status |
| --- | --- |
| Authority model | MERGED |
| Upbit KRW universe | MERGED |
| Universe freshness gate | MERGED |
| Read-only Upbit public collector | MERGED |
| Auditable universe snapshot boundary | MERGED |
| Repository/read-model input boundary | NEXT / re-implement cleanly in BOT |

## Architecture

```text
Upbit / Market Data
        ↓
Market Scanner
        ↓
Strategy Factory / Registry
        ↓
Backtest / OOS / Walk-Forward / Monte Carlo
        ↓
Champion–Challenger
        ↓
Strategy Router ──→ NO_TRADE
        ↓
Council / Red Team / Arbiter
        ↓
Deterministic Risk
        ↓
PAPER / LIVE_SHADOW
        ↓
Order / Fill / Position / Protection
        ↓
Outcome Attribution
        ↓
Canonical Event Ledger
        ↓
Decision Replay
```

BLACK ORACLE REPORT may provide versioned evidence through an explicit contract, but BOT must remain operable without BOR.

## Development

```bash
npm install
npm run lint
npm run test:trading
npm run build
npm run dev:trading
```

## Repository operating cycle

Every development cycle follows:

`PLAN → RESEARCH REVIEW → IMPLEMENT → TEST → VERIFY → DOCUMENT → PR/MERGE → SLACK REPORT`

The active plan is stored in `docs/automation/ACTIVE_SPRINT.md`. A cycle is not complete until the plan/status is updated and the result is reported to the BLACK ORACLE Slack channel.

See:
- `docs/automation/OPERATING_CYCLE.md`
- `docs/plans/2026-09-21-alpha-bootstrap.md`
- `docs/research/2026-09-21-bootstrap-review.md`

## Relationship to BLACK ORACLE REPORT

| Product | Primary responsibility | Trading authority |
| --- | --- | --- |
| **BLACK ORACLE BOT** | Strategies, validation, routing, risk, execution, outcomes | Controlled |
| **BLACK ORACLE REPORT** | Evidence, research, synthesis, reports, archive | None |

**Share contracts and lineage. Do not share authority.**
