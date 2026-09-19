# Cycle 004 — Financial Chart Accessibility and Mobile Interaction

Date: 2026-09-20
Status: TEST / REFERENCE
Research ID: D-003
Production impact: None

## Executive summary

TradingView Lightweight Charts is a strong reference candidate for BLACK ORACLE's market visualization layer because it is open source, Apache 2.0 licensed, compact, streaming-capable and mobile-ready. However, its official accessibility tutorial states that accessibility attributes and behavior are not built in by default; an accessibility layer/plugin must be added by the integrator.

Sources:
- https://www.tradingview.com/lightweight-charts/
- https://tradingview.github.io/lightweight-charts/docs
- https://tradingview.github.io/lightweight-charts/tutorials/a11y/intro

Evidence quality: A (official product/documentation).

## Gap against BLACK ORACLE

A visually polished chart is not enough. BO's redesigned mobile-first financial workspace needs a standard chart contract covering:

- touch target behavior and crosshair gestures,
- keyboard navigation on desktop,
- screen-reader summary/announcements,
- non-color-only representation of gain/loss/signal state,
- textual fallback for key values,
- reduced-motion behavior,
- chart performance under streaming updates.

## Hypothesis

A chart wrapper with explicit accessibility semantics and mobile gesture rules can preserve the premium dense-finance experience without materially degrading rendering performance or interaction speed.

## Experiment — EXP-D003

Prototype a BO chart wrapper around Lightweight Charts in an isolated UI sandbox. Use one candlestick + volume view and one equity-curve view.

Compare baseline integration against BO wrapper with accessibility plugin/semantics.

### Success metrics

- keyboard access to required interactive controls;
- screen-reader-accessible chart title and current/selected value summary;
- gain/loss and signal state understandable without color alone;
- no accidental page-scroll lock during normal mobile chart interaction;
- responsive layout at BO target mobile widths;
- measured rendering/interaction regression documented rather than assumed.

## Decision

**TEST / REFERENCE.** Lightweight Charts is eligible for a prototype, not yet an architectural adoption. Its attribution requirements must be respected. Advanced Charts/Trading Platform licensing should not be assumed equivalent to the open-source library.

## Implementation candidate

Create a presentation-layer `BOFinancialChart` wrapper so chart vendor APIs do not leak through domain screens. The wrapper should accept canonical market series, annotations, signal/evidence markers and a semantic summary model. This keeps later vendor replacement possible and centralizes accessibility behavior.
