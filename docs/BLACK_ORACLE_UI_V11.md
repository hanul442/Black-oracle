# BLACK ORACLE UI V11

## Approved direction

- Visual language: **Toss Securities × Palantir** — calm consumer-finance clarity with institutional depth.
- Primary model: **Command Center** — the first screen answers what the system sees, decides, holds, earns, and blocks.
- IA: **Command / Markets / Oracle / Trade / Lab / System**.
- Density: **mobile-first**. Progressive disclosure beats dense always-visible panels.
- Interaction: every important object is drillable: instrument, decision, evidence, council, strategy, trade, event.
- Charts: **preserve existing validated charts**. Recompose them into the new hierarchy instead of replacing them with decorative visuals.

## Product question

Every screen should make at least one of these questions easier to answer:

1. What is BLACK ORACLE observing now?
2. Why did it reach this decision?
3. What is currently open, at what entry, with what stop and targets?
4. Which Evidence, Strategy, Council, Risk and Order records are connected to the decision?
5. What worked or failed after the trade?
6. Is the runtime healthy, blocked, stale or missing data?

## Information architecture

### Command

The default landing surface.

Order of attention:

1. Paper equity / daily and total result
2. Runtime pulse
3. Evidence → Strategy → Council → Risk → Decision flow
4. Portfolio equity + drawdown chart
5. Active positions / recently analyzed instruments
6. Alerts and blocked states

### Markets

- Search and canonical universe filters
- Crypto / Korea Equity segmentation
- Open-position and recently analyzed priority
- Instrument Cockpit as the detail destination

### Oracle

- Latest deterministic decision
- Evidence stream
- Council verdict and execution-authority state
- Recent decisions
- Drill-down into trade map and rationale

### Trade

- Open positions first
- Current price / paper mark
- Entry / average cost / SL / TP1 / TP2
- Trade history and realized PnL
- Closed-trade review

### Lab

- Champion Race sorted by recorded score
- OOS samples and expectancy
- Sharpe / MDD
- Monte Carlo survival
- parameter robustness
- Hard Gate state
- promotion / deployment governance

### System

- Runtime status and staleness
- cycle count / age / errors
- Evidence ingestion
- NARS inbox / evidence request visibility
- Council mode and execution authority
- explicit Paper/live boundary

## Instrument Cockpit

The Instrument Cockpit is the main detailed workspace.

Required composition:

1. Latest Oracle decision
2. Active Paper position summary
3. Existing OHLCV chart
4. ENTRY / SL / TP1 / TP2 overlays
5. Decision Replay
6. Evidence list
7. Council summary and member drill-down
8. Strategy and Risk lineage
9. Order / Trade / Outcome events

Missing values are rendered as unavailable. The UI must never fabricate a price, forecast, evidence item, or runtime state.

## Motion system

Motion explains state; it is not decoration.

### Use

- page transition: 150–250 ms fade / small vertical shift
- card reveal: restrained stagger
- state pulse: only for current/live runtime state
- bottom sheet / drawer: spring transition
- Decision flow: sequential Evidence → Strategy → Council → Risk → Decision reveal
- Decision Replay: chronological event reveal
- price/metric transitions: short and non-blocking
- chart marker motion: optional follow-up for ENTRY / SL / TP transitions

### Do not use

- permanent neon glow
- particles
- bouncing financial metrics
- decorative 3D
- simultaneous animation of every card
- motion that delays access to information

### Accessibility / performance

- respect `prefers-reduced-motion`
- target smooth mobile interaction
- use transform/opacity for most motion
- do not animate large layout changes continuously
- no animation may block scrolling or pointer input

## Scroll model

Previous nested viewport surfaces have caused mobile scroll/drag failures. V11 follows these rules:

- page shell uses `min-height: 100dvh`, not a permanently locked `height: 100dvh`
- primary pages use document scrolling
- only intentional overlays use their own `overflow-y-auto`
- touch surfaces keep vertical pan enabled
- fixed bottom navigation reserves bottom padding in page content

## Runtime protection

The UI migration must not change:

- S1R2 / Paper qualification behavior
- Strategy Router logic
- Council execution authority
- Risk gates
- order/execution behavior
- Canonical Ledger semantics
- Evidence ingestion contracts

UI work reads the existing contracts and makes them legible. Any backend contract change must be reviewed separately.

## Rollout

1. V11 shell on isolated feature branch
2. CI typecheck + production build
3. mobile visual review
4. legacy feature-parity audit
5. interaction / scroll regression pass
6. motion polish
7. merge to main
8. Railway production smoke check
9. remove legacy surfaces only after parity is proven

V9/V10 remain available during the transition as rollback/reference implementations.
