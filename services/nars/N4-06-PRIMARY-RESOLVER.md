# N4-06 Primary Source Resolver

N4-06 turns the N4-05 authority registry into an enforceable primary-source verification boundary.

## Core rule

An official-domain match proves only that a URL belongs to a registered authority. It does **not** prove that the content supports a specific Event.

The resolver therefore uses two stages:

1. `url_verified` candidate — official-domain identity matched; no Evidence score change.
2. `content_verified` artifact — content manually/adapter verified and hashed; may affect Evidence scoring.

## Security properties

- scheme must be HTTPS
- URL userinfo is rejected
- exact official domains and true subdomains are accepted
- suffix spoofing such as `sec.gov.evil.com` is rejected
- userinfo spoofing such as `https://sec.gov@evil.com/` is rejected
- only `reviewed` authority-registry identities can resolve

Verified test cases:

- `https://www.bok.or.kr/...` -> Bank of Korea
- `https://www.sec.gov/...` -> SEC
- `https://data.sec.gov/...` -> SEC
- `https://sec.gov.evil.com/...` -> rejected
- `https://sec.gov@evil.com/...` -> rejected

## Candidate ledger

`nars_primary_source_candidates` stores URL-verified candidate evidence separately from the Evidence Artifact ledger.

Candidate states:

- `url_verified`
- `content_verified`
- `rejected`
- `expired`

A URL-verified candidate does not contribute to primary-source scoring.

## Resolver functions

- `nars_match_authority_url(url)` — resolve HTTPS URL to a reviewed authority identity
- `nars_resolve_primary_candidate(event_id, url, ...)` — create/update URL-verified candidate
- `nars_promote_primary_candidate(candidate_id, content_hash, ...)` — promote candidate only after content hash is supplied

Promotion attaches a `content_verified` Evidence Artifact and changes the candidate state to `content_verified`.

## Calibration test

A rollback test on an existing FX Event produced:

- baseline: `70.89 / BBB0`
- URL-verified BOK candidate: `70.89 / BBB0` (no score change)
- content-verified BOK artifact with SHA-256 hash: `76.89 / A-`

All test candidate/artifact rows were rolled back.

## API

`nars-primary-resolver` is JWT + service-role protected.

GET:

- `?url=<https-url>` — preview authority resolution
- `?event_id=<uuid>` — list primary candidates for Event

POST actions:

- `action=resolve` — create URL-verified candidate
- `action=promote` — promote candidate with content hash and rescore Events

The API does not fetch and validate article contents itself yet. Official-source adapters in the next sprint can perform content retrieval, hashing and claim matching before promotion.
