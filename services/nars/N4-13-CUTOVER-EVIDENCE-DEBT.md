# N4-13 Cutover evidence debt

N4-13 turns the N4-10 hard gates into an exact operator debt register and a
ranked next-sample queue. It does not weaken a gate, declare cutover readiness,
or authorize NARS v3 retirement.

## Operational surfaces

### nars_cutover_evidence_debt_v1

One row per gate requirement with:

- current value
- required value
- exact deficit
- PASS or BLOCKED status
- the action required to remove the deficit

The view covers Pipeline, Calibration, Comparator, and Evidence. It is
service-role-only and uses invoker security.

### nars_cutover_next_samples_v1

The queue materializes the next work instead of only reporting a red gate:

- stale Events that still need a current score
- lowest-margin pending merge candidates
- closest-below-threshold split candidates
- comparator requirements and genuine v3-only misses
- highest-priority Events missing content-verified primary evidence

Calibration sample requirements expand when an observed false count means the
current sample size cannot satisfy the configured false-rate ceiling.

## Pipeline repair

The event scorer now orders unscored or stale Events ahead of already-current
Events. This removes starvation when the corpus is larger than a bounded scoring
batch while preserving score version 4.5.0-diversity-v1.

The production repair scored eight previously starved Events. The fresh
calibration run reports zero aged-unscored Events and Pipeline PASS.

## Comparator boundary

The comparator has only one successful manual v3 shadow seed. The live NARS
v3 Google Sheet remains active, but no recurring authenticated bridge currently
delivers its NEWS rows to nars-shadow-batch.

Only genuine prospective v3_shadow observations count. Synthetic sightings,
rewritten timestamps, or backfilled collector matches are forbidden.

## Live Wire

The service-role-only NARS Live Wire supports:

- view=cutover_debt
- view=cutover_samples
- optional gate and kind filters for cutover_samples

Both responses include automaticRetirement=false.

## Retirement invariant

READY means eligible for a separate human review. It never causes retirement.
The metadata contract remains:

- automatic_retirement: false
- retirement_requires_human_authorization: true
- execution_authority: false

NARS v3 stays live until a named human explicitly authorizes retirement in a
separate action after all cutover evidence is reviewed.
