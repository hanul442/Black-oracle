# BOT Brand Assets

**Brand:** BOT — Black Oracle Trading  
**Version:** v1.0  
**Status:** LOCKED — RASTER RUNTIME TEST  
**Approved:** 2026-09-21

BOT is the strategy / execution layer of the Black Oracle ecosystem.

> Strategy → Execution → Performance

## Source of truth

The approved visual identity is the image-generated BOT brand board selected on 2026-09-21.

**Important:** the first repository-native SVG redraws do not faithfully reproduce the approved artwork. They are retained only as historical vector drafts and must not be used as the default product logo.

The preferred runtime assets are direct crops of the approved brand board, exported as high-quality WebP derivatives.

## Preferred runtime assets

- `v1/raster/bot-wordmark-dark.webp` — **default BOT wordmark for dark app/web UI**
- `v1/raster/bot-app-icon.webp` — **default compact/app icon**

These assets preserve the approved generated artwork far more faithfully than the provisional SVG redraw.

## Legacy / reference files

- `v1/bot-symbol.svg` — provisional vector redraw; do not use by default
- `v1/bot-wordmark.svg` — provisional vector redraw; do not use by default
- `v1/bot-wordmark-on-dark.svg` — provisional vector redraw; do not use by default
- `v1/brand-board.svg` — vector reference draft
- `v1/brand-tokens.json` — palette and typography tokens

## Usage

Preferred product usage:

```tsx
<img
  src="/assets/brand/bot/v1/raster/bot-wordmark-dark.webp"
  alt="BOT — Black Oracle Trading"
/>
```

## Asset policy

1. BOT = **Strategy / Execution / Trading**.
2. Use raster crop-derived assets until a **manual, faithful vector redraw** is approved.
3. Do not auto-trace or approximate the logo and silently treat it as production artwork.
4. Keep the original crop/master outside destructive optimization workflows.
5. When a faithful vector master is created, review it visually against the approved raster before replacing runtime assets.
6. Material identity changes require a new version directory; do not silently overwrite v1.

## Relationship to BOR

- **BOR** discovers, verifies and explains.
- **BOT** converts validated decisions into strategy and execution.

> **BOR discovers. BOT executes.**
