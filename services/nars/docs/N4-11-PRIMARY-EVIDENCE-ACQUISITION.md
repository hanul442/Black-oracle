# N4-11 Primary Evidence Acquisition

## Goal

Convert official-feed discoveries into content-verified primary Evidence without weakening N4-05/N4-06 provenance gates.

NARS remains evidence-only. It does not receive order or trade execution authority.

## Runtime flow

`official feed -> Document -> acquisition queue -> canonical fetch -> authority/redirect validation -> source-specific resolver -> canonical text -> title/issuer relevance gate -> SHA-256 -> Evidence Artifact -> Event rescore -> EvidencePacket -> nars_intel_outbox`

## Verification gates

A fetch is not score-eligible merely because the source URL belongs to an official domain.

A Document is promoted only when all applicable gates pass:

- starting and final URL remain inside reviewed authority domains
- HTTPS only
- no more than four redirects
- supported text-like content type
- response <= 2 MB
- canonical text >= 180 characters
- structured issuer matches when the headline contains one
- exact normalized title match, or at least two title tokens with >= 0.60 token coverage
- SHA-256 generated from normalized canonical text
- Document is already linked to the target Event
- final URL resolves to the same reviewed authority as the Document

Failed or ambiguous items remain `fetched_unverified`, `failed`, or `blocked` and do not affect Evidence Grade.

## DART resolver

DART requires a source-specific two-stage fetch.

`link.jsp -> dsaf001/main.do -> parse viewDoc(...) -> /report/viewer.do`

`main.do` is a JavaScript viewer shell and must never be treated as the filing body. N4-11 v1 briefly exposed this issue during validation; seven shell-derived test Artifacts were rolled back before the v2 resolver was enabled.

The v2 resolver hashes and validates the actual `/report/viewer.do` filing content.

## Data model

### `nars_evidence_acquisition_attempts`

Audits every acquisition attempt, including:

- requested/final URL
- HTTP status and content type
- byte/text length
- text SHA-256
- title match score
- redirect count
- source-specific resolver signals
- error code/detail
- attempt number and timestamps

### `nars_evidence_acquisition_queue_v1`

Contains official Documents that still need canonical content. Verified Documents leave the queue. Non-verified items are retried up to five times with a 30-minute cooldown.

### `nars_evidence_acquisition_metrics_v1`

Exposes 24-hour attempts, verification outcomes, queue depth, verified Artifact count and pending Black Oracle EvidencePackets.

## EvidencePacket boundary

`nars_build_evidence_packet` only returns a Packet when an Event has at least one content-verified primary Artifact.

Packets include:

- Event identity/state
- Priority and Evidence scores/grades
- score dimensions and Hard Gates
- verified primary Evidence and citations
- market/risk tags
- `authority = evidence_only`
- `execution_authority = false`

`nars_enqueue_evidence_packet` uses a deterministic payload hash plus Event ID as a dedup key. Re-running on an unchanged Evidence/Score state inserts zero duplicate packets.

## Scheduling

`nars-evidence-acquire-10m`

- schedule: `4-59/10 * * * *`
- batch size: 6
- concurrency: 3
- custom Vault token auth

The offset keeps the normal pipeline ordering approximately:

`shadow poll -> cluster -> score -> evidence acquisition`

The acquisition function also rescales affected Events and enqueues EvidencePackets immediately after successful verification.

## Live validation

Validated authorities:

- Bank of Korea
- DART / FSS
- Financial Services Commission
- Federal Reserve Board
- European Central Bank
- Bank for International Settlements

Initial single-document authority tests succeeded for all six authority families.

DART v2 smoke test validated a real viewer filing with a distinct SHA-256 and exact title match. A subsequent eight-document DART batch completed 8/8 successfully with distinct filing hashes.

At rollout, the 24-hour acquisition ledger contained verified and deliberately rolled-back/unverified validation attempts; operational success rates should therefore be evaluated on post-v2 runs rather than treating the entire initial 24-hour window as a clean production cohort.

## Safety boundary

- no direct NARS -> order path
- no autonomous trade decision
- official-domain discovery alone cannot raise Evidence Grade
- ambiguous content fails closed
- only service-role/Vault-authenticated paths can mutate the Evidence acquisition plane
