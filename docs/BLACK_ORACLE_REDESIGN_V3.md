# Black Oracle Redesign v3

## Product position

Black Oracle is not a generic trading dashboard. It is a decision operating system that turns evidence into probabilistic judgment, action, audit, and learning.

Core loop:

`DATA -> EVIDENCE -> FORECAST -> SCENARIO -> DECISION -> EXECUTION -> LEDGER -> RESOLUTION`

## Primary workspaces

1. **Command** — current system state, priority forecasts, contradictions, risk, and actions.
2. **Cases** — questions and investigations that organize evidence and hypotheses.
3. **Forecasts** — probability, confidence, scenario branches, and calibration.
4. **Council** — structured multi-lens debate and decision support.
5. **Ledger** — immutable decision and outcome history.

Secondary utilities such as raw field exploration, settings, ingestion, and legacy views remain accessible but are no longer first-class navigation destinations.

## Design direction

- 70% Command Terminal: dense, calm, operational.
- 20% Futuristic Oracle: selective motion, probability fields, signal pulse.
- 10% Editorial Intelligence: readable briefings, reports, and long-form interpretation.

## Visual principles

- Near-black neutral canvas, not pure black.
- Cyan is reserved for active intelligence/system state, not decoration.
- Emerald / amber / crimson only communicate positive / caution / risk states.
- Violet is reserved for model/oracle inference.
- Large numbers use tabular or mono treatment; prose stays neutral sans.
- Borders are quieter than content; glow is rare and only attached to live state.
- Every screen must end in a clear operational implication: what changed, why, what to watch, what to do.

## Information hierarchy

### Level 1 — operational
- system health
- priority opportunity / risk
- portfolio or paper state
- top forecast shift
- contradiction alert

### Level 2 — judgment
- probability
- confidence
- regime
- evidence balance
- scenario distribution

### Level 3 — audit
- source detail
- council rationale
- ledger history
- calibration
- experiment history

## Desktop

Desktop is an analysis and operations room. Use a 12-column grid with a high-density command surface, persistent top navigation, and contextual drill-down.

## Mobile

Mobile is an operations monitor, not a compressed desktop. Prioritize:
1. system health
2. priority action
3. forecast shifts
4. open/paper positions
5. recent ledger events

## Component system

- `MetricStrip`
- `SystemHealth`
- `PriorityForecast`
- `EvidenceBalance`
- `ContradictionAlert`
- `ScenarioBand`
- `DecisionCard`
- `RiskGate`
- `LedgerEvent`
- `CommandPanel`

## Migration rule

The redesign must not change the trading engine, persistence, forecasting semantics, or safety gates. Presentation and navigation can change aggressively; decision logic remains isolated.