# Trade Explainability P0 — Truth Contract

BLACK ORACLE must explain a trade inside the application without requiring the operator to inspect raw DB rows or ask an external assistant to reconstruct the decision.

## 1. Three levels of understanding

### Level 1 — 3 seconds
Show what happened: instrument, state, entry, exit/current price, P&L, size, time, SL/TP and classification.

### Level 2 — 10–30 seconds
Explain why it happened: Router, Risk Gate, Council, AI review, execution authority, linked Evidence, Challenger conflicts, immutable entry plan and outcome interpretation.

### Level 3 — Audit
Expose identifiers, timestamps, model/strategy version, decision matching quality, evidence IDs, Council votes and lineage gaps.

## 2. Historical truth rules

1. A closed trade must use its persisted `entryAudit.tradeMap` as the entry-plan snapshot when available.
2. A later Oracle candidate must never be presented as the historical trade's entry plan.
3. A decision may be attached to a closed trade automatically only when the market matches and the decision timestamp is within five minutes of `openedAt`; otherwise the UI must mark the lineage as uncertain.
4. Open-position SL/TP values from the live Paper position are authoritative for current protection. A latest candidate trade map is displayed separately and explicitly labeled as a new candidate.
5. Council advisory/shadow status must be visible. A profitable outcome must not imply that Council approved the trade.
6. Missing canonical metrics such as MAE, MFE, R-multiple or fill-latency edge must be shown as unavailable rather than estimated or invented.
7. Financial outcome and decision quality are separate concepts. A profitable trade with meaningful conflicts may be classified as a fragile winner and must not automatically validate the strategy.

## 3. P0 implementation surface

`src/mobile/PositionMonitor.tsx` provides the first operator-facing implementation through Trade Control:

- open position protection vs latest candidate separation;
- recent closed-trade list;
- dedicated Trade Explainability screen;
- deterministic Oracle Brief;
- decision-chain view;
- immutable entry-plan view;
- warning/contradiction view;
- outcome interpretation;
- expandable audit details.

Execution, broker, Paper qualification, persistence and trading cadence semantics are intentionally unchanged by P0.
