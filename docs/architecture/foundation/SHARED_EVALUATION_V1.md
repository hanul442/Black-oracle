# Shared PAPER-safe Evaluation v1

Status: **FOUNDATION IMPLEMENTATION / ADDITIVE**

## One Evaluation engine

Frozen v1 uses one logical Evaluation / Attribution contract for:

- Forecast calibration,
- Strategy outcomes,
- Champion comparison,
- Candidate / Experiment validation,
- Risk quality,
- Execution quality.

This PR does not rebuild existing evaluators. It defines the contract they must converge on.

## No guessed thresholds

The Foundation code contains **no product-specific promotion thresholds**.

Criteria are supplied explicitly at evaluation time:

- metric,
- operator,
- threshold,
- minimum sample count,
- required / optional.

This preserves Frozen v1's deferred-calibration rule.

## Required lineage

A new shared Evaluation record requires:

- Point-in-Time complete inputs,
- canonical data snapshot IDs,
- Decision Run IDs,
- explicit subject/version identity,
- explicit trading-cost assumptions,
- observation window.

The Foundation boundary validates each supplied Point-in-Time input against the Canonical Data Point-in-Time contract using the exact canonical logical-record/revision reference. Each PIT proof is bound to a canonical Decision Run identity and one of that run's canonical data snapshot IDs; the proof `asOf` must equal the Decision Run's official `asOf` cutoff, and the bound run/snapshot IDs must belong to the Evaluation lineage. A caller assertion or caller-selected later cutoff is not sufficient by itself.

Legacy metrics may be projected for comparison, but they remain `LEGACY_EVALUATION_ONLY` until the missing lineage is proven.

## Authority boundary

Evaluation may return:

- PASS,
- FAIL,
- INSUFFICIENT_DATA.

It never carries:

- execution authority,
- LIVE authority,
- Production activation authority,
- Champion promotion authority.

A separate governed promotion consumer may later use valid Evaluation results.

## Safety

No strategy rules, Risk, PAPER state, thresholds, database, scheduler, or runtime are changed.

## Next

Market / Asset Graph foundation, then legacy adapters and producer wiring.
