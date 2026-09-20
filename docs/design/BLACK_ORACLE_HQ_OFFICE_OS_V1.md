# BLACK ORACLE HQ — 2D Autonomous Investment Firm UX v1

Status: PROPOSED DESIGN BASELINE  
Date: 2026-09-20  
Scope: Mobile-first 2D office visualization, agent organization, Report/AutoTrade integration, operational navigation  
Production impact: None

## 0. Design thesis

BLACK ORACLE HQ is not a game layer placed on top of the product.

It is a **live visual command surface for an autonomous investment firm**. The 2D office shows what agents, teams, meetings, research, risk, and trading systems are doing now, while the existing financial workspaces remain the authoritative places to inspect reports, trades, positions, evidence, and Decision Replay.

The critical rule is:

> **Office for awareness and navigation. Full financial pages for analysis and control.**

The office may summarize or preview a report/trade. It must not replace the existing Report or AutoTrade product planes, hide risk state, or compress deep financial analysis into tiny game-like overlays.

---

## 1. Compatibility with the current product constitution

This design preserves the current canonical mobile navigation:

**Home / Report / AutoTrade / Community**

BLACK ORACLE HQ is introduced as the primary visual experience inside **Home**, not as a destructive replacement for the existing IA.

- **Home** → BLACK ORACLE HQ / live company state / attention surface
- **Report** → full research workspace
- **AutoTrade** → positions, orders, strategy, Council, Risk, Decision Replay
- **Community** → existing/planned community destination

The Office may deep-link to Report and AutoTrade entities, but it does not gain independent financial authority.

### Authority boundaries

- Report remains independent of execution authority.
- Office animation never implies an execution permit.
- Council/Red Team visuals do not bypass Arbiter or deterministic Risk.
- Trade state shown in the office is a projection of canonical trading state.
- Missing values remain unavailable; no illustrative financial values are fabricated.
- Current execution authority remains PAPER-only unless separately promoted.

---

## 2. Primary user job

On a phone, the user should be able to answer within seconds:

1. **What is the company doing now?**
2. **Which team or agent is active, blocked, or under review?**
3. **Did anything important happen in research, risk, or trading?**
4. **Which reports were created or updated?**
5. **Which positions/orders/trades changed?**
6. **Why did a trade or NO_TRADE happen?**
7. **Which team is performing well or poorly?**
8. **Can I open the full authoritative financial page immediately?**

---

## 3. Core interaction model

The mobile experience uses three layers.

### Layer A — HQ World

A pan/zoom 2D office map with rooms, desks, agents, meeting spaces, status signals, and live movement.

Purpose:
- ambient awareness
- organizational comprehension
- anomaly detection
- navigation into real work objects

### Layer B — Context Preview

Short bottom-sheet previews triggered by tapping an agent, room, event, report board, trade wall, or alert.

Purpose:
- answer “what is this?”
- show 3–5 high-value facts
- provide one primary action into the relevant full page

Bottom sheets are not deep analytical workspaces.

### Layer C — Authoritative Workspace

Dedicated full pages for:
- Report
- Instrument
- Strategy
- Council session
- Risk decision
- Position
- Order
- Trade
- Decision Replay
- Experiment / Lab

These preserve the existing full-page drill-down rule.

---

## 4. Mobile shell

Target viewport: 390–430 px CSS width.

### Persistent shell

**Top status bar**
- BLACK ORACLE wordmark / HQ label
- current PAPER authority badge
- company health pulse
- unread critical event count

**HQ canvas**
- 2D office scene
- drag to pan
- pinch to zoom
- tap to inspect
- double tap / focus action to center a room/team

**Live activity ribbon**
- horizontally scrollable high-signal events
- examples:
  - REPORT UPDATED
  - RED TEAM CHALLENGE
  - RISK VETO
  - POSITION OPENED
  - STOP MOVED
  - TEAM PROBATION
  - DATA STALE

**Quick dock**
- Reports
- Positions
- Orders
- Decisions
- Alerts

**Bottom navigation**
- Home
- Report
- AutoTrade
- Community

### Principle

The HQ map should occupy the majority of Home, but never force the user to navigate through the map to reach critical financial state.

A user can always jump directly to Report or AutoTrade using the canonical navigation.

---

## 5. Office map v1

### Zone 1 — Executive Wing
Rooms:
- CEO Office
- CIO Office
- CRO Office
- Board / Investment Committee Room

Visible purpose:
- capital allocation
- team lifecycle
- portfolio-level decisions
- major escalations

### Zone 2 — Intelligence Floor
Rooms:
- Market News Desk
- Macro Intelligence
- Filings / Official Data Desk
- Sentiment Desk
- Data Watch

Visible purpose:
- information collection
- data freshness
- breaking events
- evidence ingestion

### Zone 3 — Research Wing
Rooms:
- Research Synthesis
- Evidence Ledger
- Research Library
- Knowledge Graph / Relation Desk
- Report Production

Visible purpose:
- research generation
- evidence organization
- report lifecycle
- contradiction tracking

### Zone 4 — Specialist Wing
Rooms/desks:
- Macro
- Fundamental
- Quant
- Technical
- Sentiment
- Sector specialists

Visible purpose:
- specialist analysis
- evidence interpretation
- hypothesis development

### Zone 5 — Investment Pods
Initial pod slots:
- KR Equity
- US Equity
- Crypto
- Macro
- Event Driven
- Multi-Asset
- Incubator

Each pod visually owns:
- PM desk
- analyst desks
- mini strategy board
- capital allocation panel
- team status badge

Pods can visually expand, contract, merge, or become inactive as lifecycle state changes.

### Zone 6 — Challenge & Control
Rooms:
- Red Team War Room
- Risk Control
- Audit & Evaluation
- Model Validation

Visible purpose:
- contradiction
- veto
- overfitting / leakage checks
- attribution
- team scorecard

### Zone 7 — Trading Floor
Areas:
- Execution Desk
- Position Monitor
- Order Queue
- Portfolio Wall

Visible purpose:
- pending execution
- current positions
- fills / cancels
- protection
- realized/unrealized outcome

---

## 6. The key requirement: existing reports and trades remain easy to inspect

The office must create **bridges** into the existing BLACK ORACLE product rather than making the user hunt through characters.

### 6.1 Report Board

The Research Wing contains a visible “Report Board”.

Tap preview:
- latest report title
- asset / market
- version
- published/updated timestamp
- evidence freshness
- counterevidence status

Primary action:
**Open Full Report**

Secondary actions:
- previous version
- evidence
- related instrument

The full Report page remains the canonical reading surface.

### 6.2 Trading Wall

The Trading Floor contains a “Trading Wall”.

Always-readable summary:
- PAPER equity
- daily PnL
- total PnL
- active positions count
- blocked order / risk alert count

Tap preview:
- top active positions
- largest risk change
- latest fill
- current execution health

Primary action:
**Open AutoTrade**

### 6.3 Position terminals

Each open position may appear as a small terminal on the Trading Floor.

Tap preview:
- instrument
- LONG / SHORT
- entry / current mark
- unrealized PnL
- SL / TP
- active risk status

Primary action:
**Open Position**

Full page then exposes:
- chart
- entry / mark / SL / TP overlays
- strategy
- Council
- Red Team
- Risk
- orders
- Decision Replay
- outcome history

### 6.4 Decision Room

An Investment Committee session becomes a visible meeting.

Tap preview:
- instrument / decision
- current stage
- supporting agents
- dissent count
- Red Team status
- Risk state

Primary action:
**Open Decision Replay**

The detailed chronological trace never lives only in the 2D scene.

### 6.5 Alert Beacon

Critical risk/data issues create a persistent top-level beacon, independent of camera position.

Examples:
- stale market data
- Risk veto
- stop/protection error
- scheduler failure
- unresolved order state
- evidence contradiction

A critical alert must remain reachable even if the relevant room is currently off-screen.

---

## 7. Agent visual state model

Agent motion must represent actual system state, not random decorative wandering.

| System state | Office behavior |
|---|---|
| IDLE | seated / low-motion desk state |
| COLLECTING | active at Intelligence/Data room |
| RESEARCHING | active at Research/Specialist desk |
| WRITING_REPORT | moves to Report Production |
| ESCALATING | moves toward manager/committee |
| IN_COMMITTEE | enters Board / IC room |
| RED_TEAM_REVIEW | challenger enters War Room/committee |
| RISK_REVIEW | Risk agent moves to Risk Control |
| WAITING_APPROVAL | holds near approving authority |
| EXECUTING | Trader active at Execution Desk |
| MONITORING_POSITION | Trader/PM at Position Monitor |
| AUDITING | agent active in Audit & Evaluation |
| BLOCKED | visible status icon + blocked animation |
| ERROR | explicit fault state; no pretend work |
| PROBATION | team area marked as probation |
| RETIRED | desk inactive; lineage remains inspectable |

### Motion discipline

- movement should be short, legible, and state-driven
- no constant aimless walking
- repeated low-value events should batch
- critical flows may use a visible route trail
- reduced-motion mode replaces travel with state transitions/highlights

---

## 8. Team competition and lifecycle visualization

The office visualizes internal capital-market behavior.

### Team states

- INCUBATION
- SANDBOX
- PAPER
- CHALLENGER
- CHAMPION
- PROBATION
- RESTRUCTURE
- MERGE
- RETIRE

### Pod visual changes

**Champion**
- larger capital board
- expanded pod footprint
- higher-priority strategy board

**Challenger**
- comparison badge vs current champion

**Probation**
- warning border/status
- visible evaluation countdown
- no punitive “game over” styling

**Merge**
- two pod zones visually connect before migration

**Retire**
- desk becomes inactive
- historical performance and Strategy Vault lineage remain accessible

### Important scoring principle

PnL is not the sole ranking metric.

Team Scorecard should include:
- risk-adjusted return
- drawdown/tail risk
- OOS stability
- calibration
- cost/turnover
- regime robustness
- evidence/audit quality
- diversification contribution
- risk-discipline / avoided-loss contribution

Support teams use role-specific KPIs instead of direct PnL.

---

## 9. Room / agent previews

### Agent preview

Tap agent → bottom sheet:

- name / role / department / pod
- current task
- current room
- task start time
- upstream input
- expected output
- status: active / waiting / blocked / degraded
- recent 3 completed tasks
- team score contribution
- current escalation target

Primary action examples:
- View Work
- Open Report
- Open Decision
- Open Trade
- View Agent History

### Room preview

Tap room → bottom sheet:

- room purpose
- current occupants
- active workflow
- queued tasks
- current alert
- most recent output

Primary action depends on room:
- Report Production → Open Reports
- Trading Floor → Open AutoTrade
- Risk Control → Open Risk State
- IC Room → Open Active Decision
- Audit → Open Team Scorecards

---

## 10. Fast financial access: do not trap important data in the map

To protect usability, Home/HQ has a persistent **Quick Dock**.

### Reports
Shows:
- latest 3 reports
- updated/new badge
- asset
- freshness

### Positions
Shows:
- active positions
- current PnL
- risk badge

### Orders
Shows:
- pending / filled / canceled / blocked

### Decisions
Shows:
- latest LONG / SHORT / NO_TRADE
- stage
- Council / Red Team / Risk summary

### Alerts
Shows:
- risk
- data
- runtime
- execution
- evidence

This dock is available even if the user never pans around the office.

---

## 11. Focus modes

### Company Mode
Default whole-office view.

Answers:
“What is the company doing?”

### Team Mode
Focus a pod and nearby support functions.

Answers:
“How is this team operating and performing?”

### Decision Mode
Highlights only agents/rooms participating in one decision trace.

Answers:
“How did this investment decision move through the company?”

Visual path example:

```text
Intelligence → Research → Specialist → Pod → IC → Red Team → Risk → Trader → Position
```

### Incident Mode
Activated by critical operational/risk event.

De-emphasizes normal ambient activity and prioritizes:
- failed component
- affected positions/orders
- responsible team
- risk response
- remediation status

### Replay Mode
Replays a historical decision through the office using canonical ledger timestamps.

This is a visualization of existing Decision Replay, not a separate source of truth.

---

## 12. Home information hierarchy

The map is visually dominant, but financial truth is not subordinate to it.

### Above / over map
1. PAPER authority + runtime health
2. critical risk/incident status
3. portfolio equity / daily change compact strip

### Within map
4. active workflows
5. team / agent state
6. meetings and escalations

### Below / dock
7. Reports
8. Positions
9. Orders
10. Decisions
11. Alerts

This preserves the current requirement that Home answers what needs attention now.

---

## 13. Visual direction

### Art direction

“Premium block-figure office” rather than literal LEGO imitation.

- modular block-like 2D characters
- orthographic or shallow-isometric office
- clean geometric furniture
- compact walk cycles
- premium fintech UI chrome
- white / warm ivory office surfaces
- deep navy / charcoal information panels
- restrained gold accents
- risk red only for actual warning/destructive state

Avoid:
- toy-store visual noise
- casino glow
- cyberpunk neon
- oversized character animations
- fake celebration for profitable trades
- sad/punitive animation for losses

The office should feel like a **miniature institutional operations room**, not a casino game.

---

## 14. Technical architecture

```text
Canonical Ledger / Runtime / Report Store / Trading State
                         │
                         ▼
                  HQ Projection Layer
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     Agent State     Room State     Event Stream
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                   Office Mapper
                         │
                         ▼
                2D Renderer / PWA
                         │
                         ▼
             Mobile HQ + Deep Links
```

The Office reads existing truth. It should not become an alternative trading database.

### Recommended frontend
- React + TypeScript
- Phaser or PixiJS for 2D canvas
- existing application routing for full financial pages
- Zustand/Redux only for client projection/UI state

### Realtime
Use existing server/realtime infrastructure to publish normalized HQ events. The office does not poll every subsystem independently.

---

## 15. Canonical HQ event contract

Candidate event types:

- `INTEL_COLLECT_STARTED`
- `INTEL_ITEM_INGESTED`
- `RESEARCH_STARTED`
- `REPORT_CREATED`
- `REPORT_UPDATED`
- `THESIS_CREATED`
- `COUNCIL_SESSION_STARTED`
- `RED_TEAM_CHALLENGE_OPENED`
- `ARBITER_DECISION_RECORDED`
- `RISK_REVIEW_STARTED`
- `RISK_VETOED`
- `ORDER_PROPOSED`
- `ORDER_SENT`
- `ORDER_FILLED`
- `ORDER_CANCELED`
- `POSITION_OPENED`
- `POSITION_UPDATED`
- `POSITION_CLOSED`
- `STOP_UPDATED`
- `TEAM_PROMOTED`
- `TEAM_PROBATION`
- `TEAM_MERGED`
- `TEAM_RETIRED`
- `DATA_STALE`
- `RUNTIME_DEGRADED`

Each event should carry, where applicable:
- event_id
- timestamp
- trace_id
- agent_id
- team_id
- room_id
- entity_type
- entity_id
- severity
- source_status
- deep_link
- display_summary

The event is a projection pointer. Financial facts remain in their canonical entities.

---

## 16. Candidate HQ state objects

### Agent state
- agent_id
- role
- department
- team_id
- status
- current_task_id
- current_room_id
- current_trace_id
- started_at
- blocked_reason
- health
- last_event_at

### Team state
- team_id
- lifecycle_state
- mandate
- allocated_paper_capital
- active_strategies
- active_positions
- scorecard_version
- scorecard_summary
- probation_reason
- next_evaluation_at

### Room state
- room_id
- room_type
- occupants
- active_trace_ids
- queue_depth
- health
- alert_severity

---

## 17. MVP v1

### Goal
Make BLACK ORACLE visibly feel like a functioning investment company **without losing access to serious financial information**.

### Scope
- 1 mobile HQ map
- 12–15 visible agents
- 3 active pods
- Executive / Intelligence / Research / Specialist / Red Team / Risk / Trading zones
- deterministic state-driven movement
- live activity ribbon
- Quick Dock
- Report Board
- Trading Wall
- Agent and Room preview sheets
- deep links into existing Report / AutoTrade / Decision Replay
- team lifecycle badges
- PAPER-only authority

### Explicitly out of MVP
- decorative free-roaming NPC behavior
- voice chat between agents
- 3D
- multiple office floors
- real-capital execution
- dozens of concurrent animated agents
- redesigning Report/AutoTrade from scratch

---

## 18. Implementation sequence

### Sprint HQ-0 — Contracts
- inventory current Report / Trade / Position / Decision routes
- define HQ event/state projection
- define agent/team/room IDs
- verify deep-link contract
- no visual build until entity links are known

### Sprint HQ-1 — Static office shell
- map
- rooms
- camera/pan/zoom
- mobile shell
- Quick Dock
- fake financial data prohibited; use empty/loading states until wired

### Sprint HQ-2 — Live agent state
- normalized events
- room occupancy
- state-driven movement
- activity ribbon
- degraded/error states

### Sprint HQ-3 — Financial bridges
- Report Board → Report
- Trading Wall → AutoTrade
- Position terminal → Position
- IC meeting → Decision Replay
- Risk room → Risk detail
- alert deep links

### Sprint HQ-4 — Team competition
- Team Scorecard
- capital allocation projection
- Champion / Challenger / Probation
- Merge / Retire visualization
- historical lineage links

### Sprint HQ-5 — Replay / polish
- Decision Mode
- Replay Mode
- reduced motion
- performance budget
- mobile QA
- accessibility
- visual polish

---

## 19. Acceptance criteria

A build is not considered successful merely because the office looks good.

The MVP passes only if:

1. A user can open the latest full Report in no more than two intentional taps from HQ.
2. A user can reach active positions and current risk in one tap from the Quick Dock.
3. Tapping an active trade/position opens the authoritative existing entity page.
4. A visible IC / Red Team / Risk event links to the same canonical trace shown in Decision Replay.
5. Critical risk/runtime alerts remain visible regardless of camera position.
6. No animation fabricates a task that is not represented by system state.
7. Missing financial values remain unavailable rather than illustrative.
8. Office rendering does not block document scrolling or bottom navigation.
9. Reduced-motion mode preserves all state information.
10. Existing Report and AutoTrade behavior remains functionally intact.
11. HQ adds no execution authority.
12. The user can understand what the company is doing without opening every agent.

---

## 20. Design decision

BLACK ORACLE HQ should become the visual identity of the autonomous investment-firm concept, but **not the sole interface**.

The target experience is:

```text
OPEN APP
   ↓
HOME / BLACK ORACLE HQ
   ↓
see company activity + risk + reports + trading state
   ↓
tap meaningful object
   ↓
short preview
   ↓
open full Report / Position / Trade / Decision / Risk page
```

This preserves both sides of the product:

- **the emotional/intuitive value** of watching an autonomous company operate, and
- **the analytical/operational value** of serious financial workspaces.

The 2D office is therefore a live index into BLACK ORACLE, not a replacement for BLACK ORACLE.
