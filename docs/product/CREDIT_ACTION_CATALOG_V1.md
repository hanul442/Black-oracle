# BLACK ORACLE Credit Action Catalog v1

Status: PROPOSED PRODUCT PRICING CATALOG  
Date: 2026-09-20  
Unit: all visible charges are multiples of 100 Credits.

This catalog expands `CREDIT_ECONOMY_V1.md`. Prices are provisional until measured variable costs are available.

## 1. Design goal

Credits should feel generous under normal paid use.

The user should not think:

> I must save every Credit.

The intended feeling is:

> My subscription covers ordinary use; Credits matter when I ask BLACK ORACLE to do additional work for me.

## 2. Credit tiers by workload

### Tier S — 100 C

Small incremental AI work over already-available data.

Examples:

- ask one concise question about an existing report,
- explain one chart movement,
- summarize one filing,
- summarize one news item and its likely relevance,
- explain why a Grade changed using already-computed report data,
- generate one watchlist summary from existing report state.

### Tier M — 200–300 C

One additional specialist or bounded analytical transformation.

Examples:

- invite one specialist,
- add one Red Team comment,
- source cross-check on a bounded claim,
- compare two assets using existing reports,
- re-analyze one report section,
- explain disagreement between two Analysts,
- technical-indicator interpretation with existing market data.

### Tier L — 400–700 C

Fresh evidence retrieval, multiple specialists or a meaningful rerun.

Examples:

- Report refresh,
- Event Impact analysis,
- 3–5 asset comparison,
- alternative scenario analysis,
- different forecast horizon analysis,
- one additional Debate round,
- Red Team deep challenge,
- Watchlist Daily Brief generated on demand.

### Tier XL — 1,000–2,000 C

New canonical research output.

Examples:

- new Security Report,
- new Crypto Report,
- deep Company Report,
- Industry/Sector Report,
- Market Report,
- multi-specialist comparative research.

### Tier Research — 2,000–5,000+ C

User-directed custom research with uncertain search depth or larger scope.

Must use quote-before-run rather than a fixed blind charge.

## 3. Report interaction catalog

| Action | Credits | Plan |
|---|---:|---|
| Read entitled existing Report | 0 | Entitled Plan |
| Ask simple question | 100 | Plus |
| Ask sourced follow-up | 100 | Plus |
| Explain Grade change | 100 | Plus |
| Explain chart/report marker | 100 | Plus |
| Explain one Evidence item | 100 | Plus |
| Compare old vs new Report summary | 200 | Pro |
| Re-analyze one section | 300 | Pro |
| Refresh whole Report | 500 | Pro |
| Request alternative horizon | 500 | Pro |
| Request alternative Bull/Base/Bear scenario | 500 | Pro |
| Historical thesis back-check | 500 | Pro |
| New canonical Report | 1,000–2,000 | Max |

If a requested output is already precomputed and entitled, opening it costs 0.

## 4. Analyst / Debate catalog

| Action | Credits | Plan |
|---|---:|---|
| Read full existing Debate | 0 | Plus+ |
| Explain Analyst disagreement | 100 | Plus |
| Invite standard specialist | 200 | Pro/Max |
| Invite high-cost specialist | 300 | Pro/Max |
| Red Team focused objection | 300 | Pro/Max |
| Additional Debate round | 500 | Max |
| Full Debate rerun | 700 | Max |
| Custom expert panel | 700–1,500 | Max |

The UI should display which Analysts will run before charging.

## 5. Evidence catalog

| Action | Credits | Plan |
|---|---:|---|
| Read linked news/filing | 0 | Core+ |
| Read entitled Evidence detail | 0 | Pro+ |
| Quick filing impact | 100 | Plus+ |
| Quick news impact | 100 | Plus+ |
| Source cross-check | 200 | Pro+ |
| Counterevidence scan | 300 | Pro+ |
| Fresh multi-source evidence sweep | 500 | Pro/Max |
| Deep evidence dossier | 1,000+ | Max |

## 6. Chart / Forecast catalog

| Action | Credits | Plan |
|---|---:|---|
| Basic chart | 0 | Core+ |
| Historical Report markers | 0 | Core+ |
| Basic indicators | 0 | Core+ |
| Existing support/resistance | 0 | Entitled surface |
| Existing Forecast path | 0 | Pro+ |
| Ask chart explanation | 100 | Plus+ |
| Fresh technical interpretation | 200 | Pro+ |
| Recalculate support/resistance analysis | 200 | Pro+ |
| Alternative forecast horizon | 500 | Pro+ |
| Alternative scenario path | 500 | Pro+ |
| Deep forecast stress analysis | 700 | Max |

## 7. Compare catalog

| Action | Credits |
|---|---:|
| 2 assets, existing reports | 300 |
| 3–5 assets, existing reports | 500 |
| 2 assets + fresh evidence | 500 |
| 3–5 assets + fresh evidence | 700–1,000 |
| sector peer pack | 1,500+ |

Comparison remains report/research oriented, not user-specific portfolio sizing.

## 8. Watchlist catalog

| Action | Credits | Plan |
|---|---:|---|
| Save/remove watchlist item | 0 | Core+ |
| View changes | 0 | Core+ |
| On-demand AI watchlist brief | 100 | Plus+ |
| Fresh evidence watchlist scan | 300 | Pro+ |
| Cross-watchlist theme synthesis | 500 | Pro+ |
| Scheduled watchlist research | per run | Max |

## 9. Alert catalog

### Monitoring

| Duration | Base |
|---|---:|
| 24h | 100 |
| 7d | 200 |
| 30d | 400 |
| 90d | 900 |

### Complexity

| Complexity | Add |
|---|---:|
| one condition | 0 |
| 2–3 conditions | +100 |
| complex Boolean logic | +200 |
| cross-asset dependency | +200 |
| semantic AI judgment | +300 |
| custom evidence condition | +300 or quote |

No per-notification charge.

### Triggered research

If an Alert triggers a research action, the research action is charged only when executed.

User must set:

- maximum triggered runs,
- maximum Credit spend,
- Alert expiry.

## 10. Scheduled Intelligence catalog

Examples:

| Scheduled job | Indicative Credits/run |
|---|---:|
| simple watchlist brief | 100 |
| market/event digest | 200 |
| sector brief | 300 |
| company update | 300–500 |
| full scheduled report | 1,000+ |

Scheduled Intelligence is Max-only in v1.

The UI should display projected 30-day Credit demand before activation.

## 11. Deep Research quote model

Custom Deep Research should not pretend every task costs the same.

A quote may be computed from:

- number of subjects,
- number of fresh source searches,
- number of specialist Analysts,
- Debate enabled/disabled,
- Red Team enabled/disabled,
- forecast requested,
- depth/length target,
- comparison count.

The quoted amount must be fixed before execution unless the user explicitly approves a maximum-spend range.

## 12. Credit package logic

Purchased Credits should be sold in large, simple units, not 100-Credit micro-purchases.

Candidate package sizes for later pricing design:

- 5,000 C
- 15,000 C
- 50,000 C
- 150,000 C

Actual KRW prices are intentionally not specified until cost telemetry and target margin are measured.

## 13. Recurring plan grants

Provisional:

| Plan | Daily | 30-day theoretical grant | Balance cap |
|---|---:|---:|---:|
| Plus | 500 | 15,000 | 15,000 |
| Pro | 1,500 | 45,000 | 45,000 |
| Max | 5,000 | 150,000 | 150,000 |

This makes ordinary use feel included while retaining Plan gates.

Examples:

- Plus can use light Q&A and Alerts regularly.
- Pro can use frequent report analysis and refreshes.
- Max can actively commission research.

## 14. Fairness rules

- No hidden Credit deductions.
- No charge for opening already-computed entitled content.
- No repeated charge to revisit the same generated result.
- Failed jobs automatically reverse reserved Credits.
- Cached/shared reports avoid repeated compute charges.
- Alert delivery count does not create charges.
- Any automatic future AI action has a user-set spend cap.
- Credits do not bypass Plan entitlements.

## 15. Calibration plan

Before prices become commercial:

1. instrument every action,
2. run representative tasks,
3. measure cost distribution,
4. identify cache-hit rate,
5. model heavy users per Plan,
6. set KRW Plan prices,
7. map 100 Credits to a sustainable internal cost allowance,
8. adjust action prices and daily grants together.

The current catalog is a product UX contract, not final billing economics.
