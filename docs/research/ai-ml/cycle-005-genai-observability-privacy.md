# Cycle 005 — Council/Router observability and privacy boundary

Date: 2026-09-20
Research ID: AIML-004
Status: TEST / REFERENCE
Experiment: EXP-AIML004
Production impact: None

## Research question
How should BLACK ORACLE trace Council/Router model and tool activity without making evidence replay depend on unstable external conventions or leaking sensitive prompt/tool content?

## Source and evidence
OpenTelemetry's official 2026 GenAI observability material describes traces containing agent invocation, model/chat spans and tool execution spans, plus model identity, token usage, finish reasons, latency metrics and optional content capture. It explicitly notes that prompt/tool content is not captured by default because it may contain sensitive data. The broader semantic-conventions specification remains under active development. Evidence grade: A- official infrastructure guidance, with stability caveat.

## Gap
AIML-003 already selected stable BO trace IDs + versioned adapters, but it does not yet define a privacy/data-minimization policy for trace content or a replay-safe distinction between metadata and sensitive payloads.

## Hypothesis
A two-tier trace envelope — metadata always-on, content opt-in/redacted/encrypted — can preserve operational observability and experiment lineage while materially reducing sensitive-data exposure.

## EXP-AIML004
Instrument a sandbox Council decision with:
- stable BO decision/trace/span IDs
- model/provider/version
- tool name/version and result fingerprint
- token counts, latency, retries, finish reason
- prompt/template hash
- evidence IDs and experiment ID

Run three capture policies:
1. metadata only
2. redacted structured content
3. full content in isolated research storage

### Success metrics
- ability to reconstruct execution topology
- ability to attribute latency/cost/retries
- replay/debug usefulness
- sensitive-field exposure count
- storage volume
- compatibility with changing OTel semantic-convention adapters

## Proposed rule
BO evidence identity must not depend on external OTel attribute names. Internal IDs/schema are canonical; OTel is an export/observability adapter. Full prompts, completions, tool arguments and results are not recorded by default. Evidence snapshots should be referenced by IDs/fingerprints where possible.

## Risks
- Metadata can still contain sensitive identifiers.
- Over-redaction can make failures impossible to diagnose.
- External GenAI semantic conventions can change.

## Decision
TEST / REFERENCE. This refines AIML-003 rather than creating a competing trace system.

## References
- OpenTelemetry, *Inside the LLM Call: GenAI Observability with OpenTelemetry* (2026-05-14).
- OpenTelemetry Semantic Conventions / Specification.
