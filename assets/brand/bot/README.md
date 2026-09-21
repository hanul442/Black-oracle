# BOT Brand Assets

**Brand:** BOT — Black Oracle Trading  
**Version:** v1.0  
**Status:** LOCKED  
**Approved:** 2026-09-21

BOT is the strategy / execution layer of the Black Oracle ecosystem.

> Strategy → Execution → Performance

## Source of truth

The approved visual direction is the BOT logo system selected on 2026-09-21: a bold geometric wordmark with a triangular execution mark, deep navy / graphite materials and a controlled electric-blue accent.

Repository-native SVGs under `assets/brand/bot/v1/` are the implementation source of truth for product work.

## Files

- `v1/bot-symbol.svg` — primary symbol on light/transparent backgrounds
- `v1/bot-wordmark.svg` — primary wordmark + descriptor
- `v1/bot-wordmark-on-dark.svg` — dark-surface wordmark
- `v1/brand-board.svg` — compact visual reference board
- `v1/brand-tokens.json` — palette and typography tokens

## Usage

Preferred product usage:

```tsx
<img src="/assets/brand/bot/v1/bot-wordmark-on-dark.svg" alt="BOT — Black Oracle Trading" />
```

Use the symbol alone for app icons, favicons, compact navigation and avatars.

## Brand rules

1. BOT = **Strategy / Execution / Trading**.
2. Use electric blue as an execution accent, not as decoration.
3. Green / amber / red are reserved for semantic market and risk states.
4. Do not introduce crypto-coin, casino, Lamborghini, money-stack or gaming-HUD imagery.
5. Keep clearspace around the symbol equal to at least 25% of the symbol width.
6. Do not distort, rotate or redraw the v1 mark inside production UI.
7. Wordmark copy must remain **BOT / BLACK ORACLE TRADING**.
8. When the identity changes materially, create `v2/`; do **not** silently overwrite v1.

## Relationship to BOR

- **BOR** discovers, verifies and explains.
- **BOT** converts validated decisions into strategy and execution.

Preferred ecosystem line:

> **BOR discovers. BOT executes.**
