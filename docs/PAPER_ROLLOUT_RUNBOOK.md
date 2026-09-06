# BLACK ORACLE — Sprint 5 Production PAPER Rollout Runbook

Status: **PRE-DEPLOYMENT / FAIL-CLOSED**

This runbook applies only to the Evidence-governed **PAPER** runtime. It does not authorize live exchange execution, exchange credentials, withdrawals, leverage, automatic strategy promotion, or production risk-limit changes.

## 1. Release topology

Development history is intentionally stacked:

1. PR #17 — `sprint/3b-trading-centric-realignment`
2. PR #19 — `sprint/3c-log-first-operator-console`
3. PR #20 — `sprint/5-evidence-governed-validation-closure`

Do **not** use sequential merges of #17 → #19 → #20 into `main` as the production rollout mechanism. If `main` is connected to automatic production deployment, sequential merges can expose intermediate architecture states.

When every deterministic rollout gate is closed and explicit human approval is recorded, prepare one release candidate from the **exact reviewed Sprint 5 head** containing the complete stacked diff and target that candidate directly at `main`.

No release branch or main merge should be created while `assessPaperRollout(...)` is `BLOCKED` or `READY_FOR_HUMAN_APPROVAL`.

## 2. Required pre-deployment gates

All are blocking:

- stacked lineage reviewed and accepted
- exact candidate revision has Green core CI
- dependency/authentication security gate PASS
- local desktop/mobile operator QA PASS
- Vercel-protected Preview accessible to the authorized QA runner
- deployed Preview SHA equals the exact candidate head
- authenticated deployed desktop/mobile Monitor / Positions / Audit / Lab QA PASS
- deployed `/api/trading-readiness` returns a safe JSON response
- `/api/trading-readiness` reports production PAPER preflight READY
- Evidence-refresh → lease release → Paper-cycle scheduler change reviewed
- production risk limits confirmed unchanged
- explicit human approval recorded after all deterministic gates pass

Unknown, inaccessible, stale, or unverified evidence counts as **BLOCKED**, never as an assumed pass.

## 3. Safe rollout order

The rollout has two independent deployment surfaces: the Vercel application/runtime and the Supabase scheduler Edge Function.

Use this order:

### Phase A — deploy the complete Sprint 5 application/runtime

Deploy the exact approved release candidate to production while leaving the currently deployed scheduler behavior unchanged.

Expected safe transient state:

- the old scheduler may continue invoking Paper cycle only;
- Sprint 5 governance sees absent/stale structured Evidence and fail-closes **new ENTER**;
- existing deterministic stop-loss / take-profit / technical EXIT authority remains active;
- no production risk limit changes are permitted.

This creates a conservative temporary state: **entries can stop, protective exits cannot**.

Immediately verify:

- production alias resolves to the approved commit;
- `/api/trading-readiness` is reachable and safe;
- runtime checkpoint is readable;
- scheduler target remains `https://black-oracle.vercel.app`;
- no exchange/live execution surface exists.

### Phase B — deploy the reviewed Evidence-first scheduler Edge Function

Only after Phase A verification, update the scheduler implementation from deployed v9 behavior to the reviewed Sprint 5 sequence:

`Evidence Refresh → lease release → Paper Cycle`

Do not change scheduler target, cadence, production risk limits, exchange credentials, or live authority as part of this step.

Expected semantics:

- Evidence refresh failure produces degraded telemetry;
- Paper cycle still runs so protective exits remain available;
- HTTP 409 remains a safe concurrent-worker skip;
- absent/stale Evidence continues to block new ENTER;
- scheduler success is not reported when Evidence refresh is degraded.

## 4. Post-deployment verification

The new validation window starts only after both conditions occur:

1. at least one successful source-backed Evidence refresh is persisted; and
2. at least one subsequent Sprint 5 governed Paper cycle is persisted.

Record that timestamp as `PAPER_VALIDATION_WINDOW_STARTED_AT` in the release notes/operational record. Never backfill time from the pre-Sprint-5 soak.

Verify on the operator surfaces:

- Evidence IDs are present when a new ENTER is eligible;
- zero Evidence-less ENTER occurs;
- Scenario Set and Council Run IDs are linked to decisions;
- Audit Completeness dimensions reflect actual persisted links;
- Integrity incidents are persisted and unresolved critical incidents fail closed;
- scheduler telemetry distinguishes degraded Evidence refresh from Paper-cycle failure;
- protective EXIT still executes when Evidence/Governance is unavailable.

## 5. Fresh PAPER promotion window

No small-live candidate may be considered until the fresh post-rollout window satisfies the existing Live Eligibility gate, including at minimum:

- >= 14 PAPER observation days
- >= 60 closed trades
- >= 95% Evidence coverage
- zero Evidence-less ENTER
- >= 90% Audit Completeness average
- zero weak executions
- Blind validation PASS
- Walk-forward PASS
- Monte Carlo PASS or WATCH, never REJECT/INSUFFICIENT
- max drawdown <= 5%
- zero daily-risk breaches
- zero risk bypasses
- zero stale/duplicate execution-integrity violations
- zero fatal runtime incidents
- zero unresolved critical incidents
- regime robustness PASS
- cost stress PASS

Even after all quantitative gates pass, the system may create only a human-reviewed small-live candidate. The eligibility evaluator itself never grants exchange execution authority.

## 6. Rollback

Keep the previously deployed application revision and scheduler v9 behavior identifiable before rollout.

If a critical application/runtime defect is detected after Phase A or B:

1. stop any further rollout action;
2. preserve the latest checkpoint and incident evidence;
3. restore scheduler behavior to the previously known v9 Paper-cycle path first when practical;
4. restore the previous known-good application deployment;
5. verify scheduler HTTP status, runtime checkpoint health, open positions and protective exits;
6. record an Integrity/Incident entry and do not resume the fresh validation clock until the defect is resolved and a new governed window starts.

A scheduler rollback before application rollback is conservative because the Sprint 5 application without fresh Evidence blocks new entries while retaining protective exits.

## 7. Hard prohibitions for this rollout

This release must not include:

- live exchange order endpoint
- exchange API key / private WebSocket credential
- withdrawal permission
- leverage or derivatives
- LLM order authority
- automatic Champion promotion
- automatic Strategy Factory production promotion
- relaxed production risk limits
- bypass of Vercel/Firebase authentication for production
- retroactive validation-window credit

If any of these appears in the candidate diff, the PAPER rollout is **BLOCKED** and requires a separate reviewed scope.
