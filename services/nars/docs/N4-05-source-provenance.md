# N4-05 Source Intelligence & Evidence Provenance

N4-05 adds a primary-source provenance layer above Story/Event clustering and below Black Oracle execution boundaries.

## Core rule

Evidence quality and urgency remain separate.

A repeated news story can become high Priority, but it cannot reach the top Evidence Grades without verified primary provenance.

## Data model

### `nars_authority_registry`

Identity-only registry of official authorities and their verified domains.

Examples seeded in this sprint:

- Bank of Korea
- Financial Services Commission
- Financial Supervisory Service / DART
- Korea Exchange
- Korea finance ministry
- Statistics Korea
- U.S. SEC
- Federal Reserve Board

The registry does **not** assign a reliability score. It only establishes official-source identity.

### `nars_evidence_artifacts`

Stores evidence artifacts independently from news documents.

Artifact roles:

- `primary_official`
- `primary_regulatory`
- `primary_market`
- `primary_legal`
- `primary_corporate`
- `primary_statistical`
- `secondary_news`
- `secondary_analysis`
- `social_unverified`
- `unknown`

Verification states:

- `unverified`
- `url_verified`
- `content_verified`
- `revoked`

### `nars_event_evidence_links`

Links artifacts to Events with relation, confidence and link method.

Relations:

- `supports`
- `context`
- `contradicts`
- `refutes`
- `mentions`

### `nars_source_evidence_profiles`

Observed publishers receive an `unreviewed` profile stub only. Numeric reliability values remain null until explicit calibration with evidence.

The table now supports review dimensions such as sample size, primary-citation rate, correction rate, transparency and syndication dependence.

## Scoring baseline

Current version: `4.3.1-provenance-v1`.

The N4-04 base Evidence Score remains the primary signal. Provenance is a 15% overlay rather than a second large penalty.

This calibration was chosen after the initial 4.3.0 draft pushed almost all Events into the BB range merely because no primary artifacts had yet been connected.

Current behavior:

- no verified primary source -> maximum score cap `90.99` (`AA0`)
- URL-verified primary source without content verification -> maximum `93.99` (`AA+`)
- content-verified primary source -> primary-source cap removed; other Hard Gates still apply
- verified official authorities add to effective corroborator count
- primary contradiction/refutation applies a strong consistency penalty and `A-` cap

A rollback calibration test confirmed that the same Event moved from `77.76 / A-` with no primary evidence to `83.76 / A+` when a content-verified official artifact was attached. The test authority and artifact were rolled back and did not remain in production.

## Review queue

`nars_provenance_review_queue_v1` prioritizes Events such as:

- high-Priority Event with no verified primary source
- WATCH Event with no verified primary source
- Event with primary contradiction/refutation
- Event with URL-only primary evidence that still requires content verification

This turns provenance work into an explicit operational queue instead of an invisible scoring gap.

## API

`nars-provenance` is service-role-only and JWT protected.

GET modes:

- `?event_id=<uuid>` — Event, provenance snapshot and recent score history
- `?mode=review` — provenance review queue
- `?mode=sources` — publisher evidence profiles
- `?mode=authorities` — verified authority registry; optional `country=` filter

POST attaches an evidence artifact to an Event through `nars_attach_event_evidence` and immediately calls `nars_score_events`.

## Security

- RLS enabled on all N4-05 tables
- no anon/authenticated policies
- write RPC is `SECURITY INVOKER`
- execute revoked from `public`, `anon` and `authenticated`
- Edge Function requires a valid JWT and separately checks the service-role bearer
- no trade/order execution authority exists in NARS

## Runtime verification

At N4-05 validation time:

- 8 authority identities seeded
- 7 publisher profile stubs
- 186 Events
- 0 Events left on an older score version
- 4 provenance review items
- 0 real evidence artifacts intentionally attached yet
- scheduled `nars-score-5m` runs succeeding
- security advisor: no new WARN-level NARS findings
- performance advisor: no new missing-FK-index finding

Real evidence artifacts should only be attached after an adapter or reviewer has verified the source URL/content against the authority registry.
