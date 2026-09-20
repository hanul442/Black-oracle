# Cycle 006 — Evidence-First Chart Semantics

Date: 2026-09-20
Status: TEST / REFERENCE
Research ID: D-004
Experiment: EXP-D004

## Executive summary
BLACK ORACLE charts should optimize decision comprehension, not visual density. Carbon Design System's data-visualization guidance provides a useful accessible precedent: prefer direct labels when feasible, avoid unnecessary legends, use clear language, and use texture in addition to color when visual distinction must survive color-vision limitations. BO should apply these principles to financial charts while preserving trading-specific overlays through its proposed `BOFinancialChart` abstraction.

## Evidence quality
A- as a mature official design-system precedent, not finance-specific empirical evidence.

## Gap vs BLACK ORACLE
D-003 proposed an accessible/mobile financial-chart wrapper. The remaining gap is semantic policy: signal/evidence/regime overlays can become visually overloaded and dependent on color/legend decoding, especially on Fold/mobile screens.

## Proposed application
Add a chart semantic contract:
- every chart declares its decision question
- one primary visual claim per viewport
- direct-label the primary series/threshold when space permits
- legends only when direct labeling is impractical
- state cannot depend on color alone; use shape/texture/icon/text redundancy
- Evidence/Signal/Trade markers have distinct semantic roles
- mobile detail is progressive disclosure, not simultaneous overlay
- textual summary exposes latest value, change, regime/signal state, uncertainty and evidence link

## Hypothesis
An evidence-first semantic contract will reduce interpretation errors and time-to-answer for BO mobile users without reducing access to expert detail.

## EXP-D004
Prototype the same Strategy/Market chart in two variants: current dense-overlay concept vs semantic-contract variant. Test 5-7 representative questions such as current regime, active signal, invalidation threshold, evidence event, and strategy drawdown.

## Success metrics
- task accuracy
- median time-to-answer
- wrong-series/legend errors
- number of simultaneous overlays
- accessibility checklist pass rate
- user-rated confidence only as a secondary metric

## Decision
TEST / REFERENCE. Integrate with EXP-D003; do not create a second chart component stack.

## Reference
- https://carbondesignsystem.com/data-visualization/legends/
- https://carbondesignsystem.com/data-visualization/getting-started/
