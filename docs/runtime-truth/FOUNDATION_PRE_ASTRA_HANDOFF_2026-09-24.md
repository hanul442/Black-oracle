# Foundation Pre-Astra Handoff — 2026-09-24

Status: **READY FOR ASTRA FINAL VERIFICATION**
Architecture: **BLACK ORACLE FROZEN v1**
Final cross-system audit: **intentionally not executed**

## 1. What changed

The repository baseline was migrated from the superseded BOT/BOR top-level product split to the Frozen v1 six-domain architecture without rewriting protected runtime behavior.

Governance sync:
- PR #243 — Frozen v1 canonical source + current-state audit + migration plan.

Foundation:
- PR #244 — Canonical Data / Point-in-Time contract.
- PR #245 — Immutable Decision Run / Version Registry.
- PR #246 — Material-change Event/Trigger + Evidence Lineage.
- PR #247 — Shared PAPER-safe Evaluation.
- PR #248 — Point-in-Time Market / Asset Graph.
- PR #249 — Legacy BOT/BOR/NARS adapters + Foundation composition proof.

## 2. Verification performed

Every Foundation implementation PR merged only after:

- TypeScript typecheck PASS,
- Black Oracle CI PASS,
- Trading core tests PASS,
- Supabase trading function typecheck PASS,
- trading runtime bundle PASS,
- PAPER scheduler bundle smoke PASS,
- Strategy Factory scheduler bundle smoke PASS,
- production build PASS.

No Foundation PR performed a deployment or infrastructure mutation.

## 3. Key invariants now executable

### Point-in-Time

Historical eligibility is controlled by when BLACK ORACLE could prove an exact revision was observed and ingested.

A future `eventTime` is allowed when that future event was already known at the historical cutoff.

Legacy records with missing `observedAt` or revision identity are explicitly `LEGACY_INCOMPLETE`; the adapter does not invent timestamps.

### Decision Run / Version Registry

A new Decision Run binds:

- runtime,
- market,
- as-of,
- caller decision key,
- exact component versions,
- data snapshot IDs,
- Evidence IDs,
- optional Research/Forecast/Portfolio lineage.

Legacy `traceId` is preserved but never relabeled as a canonical Decision Run without the missing proof.

Validation state and deployment state are orthogonal.

`CHAMPION + OFFLINE` is valid.

`PRODUCTION` requires a separate `productionActivationId`.

### Event / Trigger

Material-change orchestration can request selective recomputation.

It cannot authorize execution.

`SILENT` changes cannot request user alerts.

### Evidence Lineage

New Evidence requires canonical data revision lineage, source identity, content fingerprint, origin group, verification state, contradiction state, and temporal identity.

Independent-source counting uses origin lineage, not article count.

Revoked Evidence carries explicit invalidation time and can identify downstream Research / Forecast / Report / Decision Run dependencies.

### Shared Evaluation

One logical contract is available for Forecast / Strategy / Champion / Experiment / Risk / Execution evaluation.

No product thresholds were guessed.

Criteria are injected explicitly.

Evaluation has no execution, LIVE, Production activation, or Champion-promotion authority.

### Market / Asset Graph

Graph edges are Point-in-Time Canonical Data revisions.

Relationships require Evidence or canonical source-data lineage.

No invented confidence score exists.

Historical traversal cannot see later edge revocations.

First-, second-, and deeper-order paths are bounded and cycle-safe.

## 4. Legacy reuse truth

### BOT

KEEP / MODIFY.

Existing Canonical Event Ledger, Decision Replay, deterministic Risk, Router/NO_TRADE, Champion/Challenger, PAPER contracts, outcome attribution remain valuable.

Legacy history is preserved and assessed for Frozen v1 completeness rather than rewritten.

### BOR

KEEP / MODIFY.

Existing versioned, fingerprinted, citation-preserving, authority-free report/read-model/archive artifacts are reusable as Domain A/F assets.

The old claim that BOR must be a separate top-level product is superseded.

Physical repo/service separation is an implementation detail.

### NARS

KEEP.

NARS remains a Domain B evidence producer.

Current `nars.evidence.v1` preserves useful event/source/hash/run/config identity, but Frozen v1 ingress must additionally record BO `observedAt`, `ingestedAt`, canonical revision identity, and source-origin grouping.

NARS score is information priority, not trade conviction.

## 5. Current infrastructure truth

### Railway

Existing protected services were not modified by Foundation work.

No legacy service was retired.

### Supabase

Management API currently returns:

`status = ACTIVE_HEALTHY`

But direct database operations still fail with:

`connect ECONNREFUSED ...:5432`

As of this handoff, database/data-plane health is therefore **NOT VERIFIED**.

Do not perform schema migration or runtime-authority cutover until this is resolved and re-audited.

## 6. Astra verification request

Astra should verify, not redesign.

Focus on:

- violations of Frozen v1 invariants,
- hidden authority escalation,
- temporal leakage,
- identity/version ambiguity,
- false legacy upgrades,
- contract-composition contradictions,
- migration hazards created by the current Supabase outage.

Do not introduce new domains, thresholds, product scope, runtime authority, or speculative architecture.

## 7. Stop condition

If Astra finds no blocking architectural/contract issue, return the work to GPT-5.6 Sol for the **final Foundation cross-system audit**.

Persistence migration, real producer wiring, runtime-authority cutover, and service retirement remain downstream decisions.
