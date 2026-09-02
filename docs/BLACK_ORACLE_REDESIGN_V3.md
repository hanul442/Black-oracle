# Black Oracle Redesign v3

## Product position

Black Oracle is not a generic trading dashboard. It is a decision operating system that turns evidence into probabilistic judgment, action, audit, and learning.

Core loop:

`DATA -> EVIDENCE -> FORECAST -> SCENARIO -> DECISION -> EXECUTION -> LEDGER -> RESOLUTION`

## Primary workspaces

1. **Command** — current risk state, one-sentence judgment, top changes, priority forecasts, contradictions, and actions.
2. **Cases** — questions and investigations that organize evidence and hypotheses.
3. **Forecasts** — conditional transmission, probability, confidence, scenario branches, impact, and calibration.
4. **Council** — structured multi-lens debate, dissent, uncertainty, and decision support.
5. **Ledger** — chronological decision and outcome audit history.
6. **Raw Field** — secondary intelligence exploration surface; desktop uses the graph, mobile uses Nexus relationship neighborhoods.

## Reference synthesis decisions

### Workspace shell
Recent project/workspace references were translated into a persistent desktop Workspace Rail. Navigation remains visible while the top bar is reduced to page context, source state, synchronization, and account controls.

### Situation-first Command
The first screen prioritizes:
1. current risk state
2. one-sentence judgment
3. top three changes
4. metrics and supporting detail

The user should understand the current decision state before scanning a grid of numbers.

### Scenario Flow
Forecast begins with a conditional transmission path:

`Trigger -> Thesis -> Scenario branches -> Expected outcome`

Probability × impact, evidence balance, invalidation, and watch-next remain available below the flow. The flow shows a selected neighborhood rather than pretending the entire world can fit on one canvas.

### Mobile Nexus
The full Raw Field graph is desktop-only. Mobile intentionally renders a local relationship neighborhood and searchable intelligence index instead of shrinking the entire graph.

Selecting a node exposes:
- direct linked nodes
- relation weight
- node type and score
- local metadata
- route into the relevant deep decision workspace

This follows the rule that mobile should provide an equivalent relationship view without compressing a large graph into an unreadable miniature.

## Design direction

- 70% Command Terminal: dense, calm, operational.
- 20% Futuristic Oracle: selective motion, probability fields, signal pulse.
- 10% Editorial Intelligence: readable briefings, reports, and long-form interpretation.

## Visual principles

- Near-black neutral canvas, not pure black.
- Thin, low-contrast dividers and operational panels.
- Cyan is reserved for active intelligence and information state, not decoration.
- Muted gold is reserved for base-case emphasis.
- Red is reserved for contradiction, tail risk, invalidation, and destructive actions.
- Large numbers use tabular or mono treatment; prose stays neutral sans.
- Borders are quieter than content; glow is rare and only attached to live state.
- Decorative cyberpunk or AI-persona styling is minimized.
- Every screen must end in a clear operational implication: what changed, why, what to watch, what invalidates the judgment.

## Information hierarchy

### Level 1 — operational
- current risk state
- one-sentence judgment
- top changes
- system health
- priority forecast
- contradiction alert

### Level 2 — judgment
- probability
- confidence
- regime
- evidence balance
- scenario distribution
- transmission path

### Level 3 — audit
- source detail
- council disagreement
- ledger history
- calibration
- experiment history

## Desktop

Desktop is an analysis and operations room. It uses a persistent Workspace Rail, dense decision surfaces, graph exploration, and contextual drill-down.

## Mobile

Mobile is an operations monitor, not a compressed desktop. Prioritize:
1. risk state
2. one-sentence judgment
3. top changes
4. priority action / forecast shift
5. local relationship neighborhood
6. recent ledger events

Large fixed canvases are replaced with selected-neighborhood or list equivalents.

## Core interaction principles

- judgment before data volume
- evidence and contradiction are equally visible
- uncertainty remains explicit
- graphs are for relationships, not decoration
- mobile uses local neighborhoods or equivalent relationship lists
- deep analysis exposes trigger, invalidation, provenance, and next observation
- no AI character/persona should substitute for analytical structure

## Component system

- `WorkspaceRail`
- `MetricStrip`
- `SystemHealth`
- `SituationJudgment`
- `PriorityForecast`
- `EvidenceBalance`
- `ContradictionAlert`
- `ScenarioFlow`
- `ScenarioBand`
- `DecisionCard`
- `RiskGate`
- `LedgerEvent`
- `MobileNexus`
- `CommandPanel`

## Migration rule

The redesign must not change the trading engine, persistence, forecasting semantics, or safety gates. Presentation and navigation can change aggressively; decision logic remains isolated.
