# BLACK ORACLE Credit Economy v1

Status: PROPOSED COMMERCIAL CONTRACT  
Date: 2026-09-20  
Applies to: Report-first BLACK ORACLE proposal  
Billing state: Design only; no real charging authorized by this document.

## 1. Core principle

BLACK ORACLE separates:

- **Plan entitlement** — whether a capability is available,
- **Credits** — how much eligible AI/research work can be executed,
- **content access** — whether already-produced research can be read,
- **compute action** — whether a new inference/search/research workload is created.

A Credit balance never unlocks a capability that the user's Plan does not permit.

## 2. Credit denomination

The user-facing minimum price increment is **100 Credits**.

Actions should be priced in simple increments such as:

100 / 200 / 300 / 500 / 700 / 1,000 / 1,500 / 2,000 / 3,000 / 5,000.

Avoid arbitrary prices such as 137 or 423 Credits.

## 3. Included recurring Credits

Initial proposed allowance:

| Plan | Daily grant | Max recurring balance |
|---|---:|---:|
| Core | 0 | 0 |
| Plus | 500/day | 15,000 |
| Pro | 1,500/day | 45,000 |
| Max | 5,000/day | 150,000 |
| Enterprise | Contract pool | Contract |

Recurring Credits accrue up to the cap.

Purchased Credits are accounted separately from recurring Credits.

Recurring Credits are consumed first.

Purchased Credit expiration, refunds, taxes and regional billing rules require separate commercial policy before launch.

## 4. Zero-Credit actions

Normal consumption of already-computed content should not create Credit anxiety.

Proposed zero-Credit actions include:

- view price,
- view chart,
- view Grade,
- view one-line assessment,
- read news/filings,
- manage watchlist,
- read already-produced content within Plan entitlement,
- read already-produced debate within Plan entitlement,
- read Alert History,
- inspect historical forecasts within Plan entitlement.

Safety/truth-critical access must never depend on a low Credit balance.

## 5. Standard compute actions

Initial pricing units are product placeholders and must be calibrated against measured inference/search/data cost before commercial release.

| Action | Proposed Credits | Minimum Plan |
|---|---:|---|
| Simple report question | 100 | Plus |
| Quick news impact analysis | 100 | Plus |
| Quick filing impact analysis | 100 | Plus |
| Watchlist AI summary | 100 | Plus |
| Additional analyst opinion | 200 | Pro |
| Single report section re-analysis | 300 | Pro |
| Red Team additional review | 300 | Pro |
| Compare 2 securities/assets | 300 | Pro |
| Compare 3–5 securities/assets | 500 | Pro |
| Report refresh using latest evidence | 500 | Pro |
| Event impact analysis | 400–600 | Pro |
| Add debate round | 500 | Max |
| Full debate rerun | 700 | Max |
| New Security/Crypto Report request | 1,000 | Max |
| Deep Company Report request | 1,500 | Max |
| Deep Industry/Sector Report request | 2,000 | Max |
| Deep Market Report request | 2,000 | Max |
| Custom Deep Research | 2,000–5,000+ | Max |
| Multi-asset Research Pack | 2,000+ | Max |

The UI must quote the exact Credit charge **before** execution.

## 6. Expert invitation

Max may allow users to invite additional analytical roles into an existing report.

Example pricing:

- Value Analyst — 200 C
- Earnings Analyst — 200 C
- Policy Analyst — 200 C
- Microstructure Analyst — 200 C
- Sector Specialist — 200 C
- Adversarial/Red Team Analyst — 300 C

The invited analyst should reuse the existing evidence packet where possible.

If the request requires a fresh data/evidence scan, the system must disclose any additional charge before starting.

## 7. Alert Credits

Alerts are persistent monitoring workloads, so they use a duration-and-complexity model rather than one-shot pricing.

### 7.1 Base duration

| Monitoring period | Base Credits |
|---|---:|
| 24 hours | 100 |
| 7 days | 200 |
| 30 days | 400 |
| 90 days | 900 |

### 7.2 Complexity add-ons

| Rule | Add-on |
|---|---:|
| One basic condition | 0 |
| 2–3 conditions | +100 |
| Complex AND/OR logic | +200 |
| Cross-asset comparison | +200 |
| AI semantic judgment required | +300 |
| Advanced custom evidence condition | +300 or quoted |

Example:

30-day alert
+ Grade >= A
+ Price <= threshold
= 400 base + 100 multi-condition = 500 Credits.

Notification count itself does not create additional charges.

## 8. Alert action automation

Max may allow an Alert to trigger new research.

Example:

Condition met
→ request Red Team review
→ refresh report
→ notify user.

This is charged as:

1. monitoring Credit at Alert creation, plus
2. action Credit only when the research action actually runs.

Every automated action Alert must define:

- per-run cost,
- maximum runs,
- maximum Credit spend,
- expiration,
- explicit user approval before activation.

If the spend cap is reached, monitoring may continue while paid AI actions stop, depending on the rule configuration.

## 9. Scheduled research

Scheduled AI research is a compute action, not a zero-cost notification.

Example:

Weekly semiconductor brief
→ 300 Credits/run
→ 4 projected runs
→ 1,200 Credits estimated.

Before activation the product should show:

- cadence,
- estimated monthly runs,
- estimated Credits,
- maximum spend cap,
- next execution time.

## 10. Entitlement matrix

| Capability | Core | Plus | Pro | Max |
|---|:---:|:---:|:---:|:---:|
| Basic content | Yes | Yes | Yes | Yes |
| Alerts | No | Yes | Yes | Yes |
| Full Analyst Debate | Preview | Yes | Yes | Yes |
| Lead Conclusion | Preview | Yes | Yes | Yes |
| Full Report | No | No | Yes | Yes |
| Evidence/Counterevidence detail | No | No | Yes | Yes |
| Forecast price/path | No | No | Yes | Yes |
| Advanced Alert logic | No | Limited | Yes | Yes |
| Simple AI questions | No | Yes | Yes | Yes |
| Asset comparisons | No | No | Yes | Yes |
| Report refresh | No | No | Yes | Yes |
| Expert invitation | No | No | Limited | Yes |
| Red Team request | No | No | Limited | Yes |
| Debate rerun | No | No | No | Yes |
| New Report request | No | No | No | Yes |
| Deep/custom research | No | No | No | Yes |
| Scheduled research | No | No | No | Yes |
| Research-trigger Alerts | No | No | No | Yes |

## 11. Wallet accounting

Maintain separate ledgers:

- recurring_plan_credit,
- purchased_credit,
- promotional_credit if ever introduced.

Suggested spending order:

1. recurring Plan Credits,
2. promotional Credits,
3. purchased Credits.

Every debit record should preserve:

- user/account,
- plan,
- action type,
- quoted cost,
- actual charged cost,
- job/run ID,
- timestamp,
- success/failure,
- refund/reversal relation when applicable.

## 12. Failure and refund rule

A user should not pay for a job that fails before delivering the contracted output.

Proposed semantics:

- preflight validation failure → no charge,
- provider/infrastructure failure before useful output → automatic reversal,
- partial output → charge only when the action contract explicitly defines a useful partial result,
- user cancellation before execution begins → no charge,
- cancellation after expensive work begins → separately defined policy; must be disclosed before run.

Credit debits should be append-only with explicit reversal transactions rather than mutable balances without ledger history.

## 13. Quote-before-run

Any non-trivial action must show:

- what will run,
- which Plan feature is being used,
- Credit price,
- whether fresh search/data is required,
- estimated duration where useful,
- whether the action can trigger additional future charges.

No hidden cascading Credit consumption.

## 14. Cost control and unit economics

Internally, every action type should record:

- model/provider,
- input/output tokens,
- search/tool calls,
- data-provider cost,
- compute/runtime cost,
- cache hit/miss,
- analyst count,
- debate rounds,
- wall-clock latency,
- direct variable cost,
- charged Credits.

Product pricing should later target a configured gross-margin band.

Credits are a user-facing abstraction; measured cost is the internal truth.

## 15. Cache and shared-research rule

When a user requests research that can safely become shared research:

User-requested job
→ report passes validation/publication policy
→ canonical shared Report version
→ later users read the cached result at zero compute Credits within entitlement.

The requesting user pays for new work, not for every later view.

This is a major cost-control mechanism.

## 16. Anti-abuse and capacity

Credits do not guarantee unlimited concurrency.

Plans may separately define:

- concurrent jobs,
- maximum queued jobs,
- report-request rate limits,
- research depth,
- maximum analyst count per job,
- maximum debate rounds,
- maximum scheduled jobs,
- alert count.

These capacity limits must be disclosed as Plan rules, not silently enforced as hidden Credit deductions.

## 17. Commercial validation required

Before real billing:

1. instrument every AI/research action,
2. collect realistic variable-cost distributions,
3. calculate P50/P90/P99 cost per action,
4. determine sustainable Credit-to-cost conversion,
5. stress-test heavy Plus/Pro/Max behavior,
6. test cache-hit economics,
7. test Alert monitoring cost,
8. test purchased-Credit liability,
9. set monthly Plan prices only after measured unit economics.

The values in this document are product-economy defaults, not final billing prices.
