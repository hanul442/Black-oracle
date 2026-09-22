# REF-COMP-002 — ThreeUI / Rectangle Buttons

Status: **REFERENCE**
Domain: UI Component / Interaction
Source: https://threeui.com/
Captured: 2026-09-22

## Why BLACK ORACLE references it

ThreeUI is a component/motion reference. The Rectangle Button / dark-pill direction is relevant to BLACK ORACLE's compact mobile actions, segmented controls, contextual actions, and premium interaction feel.

## Pattern to extract

- compact high-contrast button geometry;
- strong hover/press feedback without visual clutter;
- premium motion used to clarify interaction;
- reusable component variants instead of one-off button styling;
- restrained use of 3D/WebGL effects.

## BLACK ORACLE translation

Prefer a BO-native component API, for example:

`<OracleAction tone size state icon>`

Potential uses:
- Report actions;
- Council drill-down;
- Method/Strategy actions;
- filter/segmented controls;
- evidence expansion;
- secondary command surfaces.

## Do not copy blindly

- decorative 3D effects that compete with financial information;
- heavy GPU/WebGL effects on every control;
- inaccessible hover-only behavior;
- styles that conflict with BO's approved mobile design system;
- motion without reduced-motion fallback.

## Current implementation status

No PR or commit explicitly named `ThreeUI` or `RectangleButtons` was found in the repository when this note was created.

Treat as a component reference until a small isolated prototype is tested against the current mobile design system.
