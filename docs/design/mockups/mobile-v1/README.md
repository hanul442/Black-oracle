# BLACK ORACLE Mobile UI v1

Status: **Approved visual reference / implementation source of truth**

This folder preserves the approved mobile-first white/gold BLACK ORACLE UI direction. These mockups are design references, not production runtime assets.

## Screens

- `home.webp` — Home / executive overview
- `markets.webp` — Markets / Korea Equity example
- `council.webp` — Council / consensus and debate
- `trade.webp` — Trade / lifecycle and execution
- `lab.webp` — Lab / champion race, Monte Carlo, experiment ledger

## Implementation rules

1. Mobile-first, single-column reading flow. Avoid desktop-style two-column splits on phone-sized screens.
2. Use the real BLACK ORACLE wordmark from `public/brand/black-oracle-wordmark.png`.
3. Preserve the white / warm ivory / restrained gold visual language.
4. Cards, tables, charts, tabs, badges, market data, and controls must be implemented as live UI components — do not rasterize them from these mockups.
5. Higgsfield-style/generated visual assets may support hero or decorative areas, but data-bearing visuals should remain code-rendered and accessible.
6. Bottom navigation primary destinations: Home, Markets, Council, Trade, Lab.
7. Treat these images as directional references; factual data, labels, and numeric values shown in mockups are illustrative unless backed by runtime data.

See `../design-system.md` for implementation guidance.
