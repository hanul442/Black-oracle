# N4-10 Calibration / Cutover Readiness

N4-10 does **not** retire NARS v3. It creates the evidence required to decide whether retirement is safe.

## Hard-gate model

`cutover_status = READY` only when all four families pass:

1. **Pipeline** — no aged unclustered or stale-scored backlog, adequate shadow-source health, no unhealthy critical connector.
2. **Calibration** — enough reviewed merge/split samples with false-merge and false-split rates below policy limits.
3. **Comparator** — enough live v3 observations on publishers also covered by v4, enough observation time, recent v3 data, and adequate v4 recall against v3.
4. **Evidence** — HIGH/FLASH Events have sufficient content-verified primary Evidence coverage.

Even `READY` does not automatically retire v3. `automatic_retirement` is permanently false in the readiness view; human authorization remains separate.

## Current policy

| Gate | Policy |
|---|---:|
| aged unclustered >15m | 0 |
| aged unscored >15m | 0 |
| healthy shadow connectors | >= 90% |
| unhealthy critical connectors | 0 |
| reviewed merge samples | >= 30 |
| false merge rate | <= 2% |
| reviewed split samples | >= 30 |
| false split rate | <= 5% |
| comparable v3 samples | >= 100 |
| comparator observation span | >= 7 days |
| newest v3 comparator age | <= 30 min |
| v4 recall vs v3 | >= 95% |
| HIGH/FLASH content-verified primary coverage | >= 80% |

## Structured subject / issuer guard

Calibration exposed a deterministic lexical failure mode in DART filings. Different issuers sharing the same filing form could be merged because the form text dominated headline similarity.

Example of a prohibited merge:

```text
(코스닥)Issuer A - 기업설명회(IR)개최
(유가)Issuer B - 기업설명회(IR)개최(안내공시)
```

`nars_structured_subject()` extracts the issuer from DART-style structured headlines. When both candidates have non-null structured subjects and the subjects differ:

- Document -> Story matching is vetoed.
- Story -> Event matching is vetoed.
- near-threshold calibration sampling excludes the pair because the split is deterministically correct.

The guard is intentionally narrow: it is applied only when a structured subject can be extracted. Unstructured newsroom headlines still use the normal lexical/event matcher.

## Production repair

The first audit found 33 cross-issuer contaminated Events containing only DART documents. No contaminated Event had an Evidence link, Primary Resolver candidate, or Black Oracle intel-outbox row.

The repair re-clustered:

- 172 Documents
- 131 Stories
- 33 contaminated Events

Post-repair validation:

```text
cross-issuer contaminated Events   0
cross-issuer contaminated Stories  0
unclustered Documents              0
unscored Events                    0
```

The repair snapshot is stored in `nars_system_meta` under `structured_subject_repair_v1`.

## Calibration review queue

`nars_refresh_calibration_samples()` maintains low-margin automatic merges and near-threshold splits for manual review.

N4-10 v2 additionally prunes:

- references to deleted/rebuilt Stories or Events
- split candidates that are already decided by the structured-subject hard veto

This reduced pending review from 142 to 77 immediately after the DART repair.

## Evidence promotion boundary

Official RSS/disclosure collection does not equal content verification.

`nars_evidence_promotion_queue_v1` distinguishes:

- `VERIFIED`
- `RESOLVER_ELIGIBLE`
- `NEEDS_CANONICAL_CONTENT`

A document from an official authority cannot satisfy the content-verified Evidence gate unless canonical content is actually retrieved/hashed and promoted through the Evidence layer.

## Security

Calibration tables use RLS and remain service-role only.

The four N4-10 views are explicitly `security_invoker=true` and deny `anon` / `authenticated` SELECT. The three calibration RPCs deny `PUBLIC`, `anon`, and `authenticated` execution; only `service_role` is granted execution.

## Current cutover state

The expected state after N4-10 deployment is **BLOCKED**, not READY. Pipeline health can pass while comparator coverage, reviewed calibration sample counts, and primary Evidence coverage are still insufficient.

NARS v3 must remain live until the hard gates are satisfied and a separate human retirement authorization is given.
