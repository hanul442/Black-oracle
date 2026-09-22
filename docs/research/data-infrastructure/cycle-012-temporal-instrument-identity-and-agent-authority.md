# BLACK ORACLE R&D — Cycle 012

Date: 2026-09-23

## Scope and duplicate control

This cycle scanned Design/UX, Quantitative Finance, AI/ML, Market & Data Infrastructure, Product/Competitor, and Evidence & Validation. The scan deliberately did not create IDs for findings already covered by D-003–D-005, Q-001–Q-004, AIML-005–AIML-007, DI-001–DI-004, or EV-001–EV-007. Two non-duplicative gaps remain material: temporal instrument identity and agent/tool authority. The latter was previously reported as Cycle 012 research but was absent from the repository/central ledger; this cycle repairs that traceability gap rather than pretending it was already committed.

---

## DI-005 — Temporal Instrument Identity / Security Master Contract

**Status:** TEST / REFERENCE  
**Evidence quality:** A- for identifier/API semantics (OpenFIGI official documentation; SEC official dissemination/API documentation); B for direct transfer to BO/KRX because KRX-specific historical identifier coverage still requires implementation-source verification.

### What is new

BLACK ORACLE already records point-in-time feature availability (DI-003) and immutable data snapshots (DI-004), but those controls can still replay the *wrong security* if historical rows are keyed only by a mutable ticker/vendor symbol. OpenFIGI documents that a FIGI is unique to an individual instrument and, once issued, does not change, while ticker/base-ticker queries can be ambiguous and may map to multiple instruments. SEC EDGAR separately exposes accession/acceptance-time semantics and real-time dissemination behavior, reinforcing that issuer/document identity and knowledge time should be explicit rather than inferred from current labels.

### Comparison with current BO architecture

Current BO direction:

`dataset snapshot -> point-in-time feature -> experiment -> decision`

Required extension:

`canonical instrument_id -> venue/listing identity -> symbol alias interval -> issuer identity -> corporate-action/event lineage -> dataset snapshot -> feature -> experiment`

A snapshot hash proves which bytes were used; it does not prove that `005930`, `META`, or another symbol was resolved to the intended economic instrument at the historical decision time. Instrument identity therefore belongs upstream of DI-003/DI-004, not inside strategy code.

### Gap

No canonical BO contract currently requires:

- immutable/canonical instrument identity separate from display ticker;
- venue/listing identity and currency;
- symbol aliases with `valid_from` / `valid_to`;
- issuer/entity identity separate from security/share class;
- predecessor/successor and corporate-action lineage;
- provider mapping version and mapping confidence;
- `known_at` for identifier/corporate-action corrections;
- explicit unresolved/ambiguous mapping state.

### Hypothesis H-DI005

If BO keys research data and replay by a temporal canonical-instrument contract rather than current ticker strings, seeded ticker reuse/change, venue ambiguity, share-class ambiguity and post-hoc mapping corrections will be detected or resolved without changing the historical economic instrument.

### EXP-DI005 — Identity continuity positive controls

Build a small security-master fixture containing at least:

1. ticker rename with unchanged economic instrument;
2. ticker reused by a different instrument after a gap;
3. same/similar ticker across venues;
4. multiple share classes under one issuer;
5. delisting/predecessor-successor case;
6. mapping correction learned after the original decision time;
7. deliberately unresolved identifier.

Compare:

- **A — symbol-only baseline**;
- **B — canonical ID + venue/listing mapping**;
- **C — B + bitemporal alias/corporate-action lineage (`effective_at`, `known_at`).**

### Success metrics

- seeded wrong-instrument joins detected: **100%**;
- silent ambiguous mapping acceptance: **0**;
- historical decision replay resolves the same canonical instrument: **100%** on clean fixtures;
- unresolved mappings fail closed or become explicit `UNRESOLVED`: **100%**;
- all mappings expose source/version/effective-time/knowledge-time provenance: **100%** for test fixtures.

These are engineering positive-control criteria, not claims about production data completeness.

### Proposed implementation path

Introduce storage-neutral `bo.instrument_identity.v1` with fields such as:

`instrument_id`, `issuer_id`, `listing_id`, `venue_mic`, `currency`, `asset_class`, `symbol_alias`, `valid_from`, `valid_to`, `known_at`, `source`, `source_version`, `external_ids`, `predecessor_id`, `successor_id`, `mapping_status`.

`bo.experiment.v1` and `bo.audit_bundle.v1` should reference the canonical identity/identity-manifest hash. Display tickers remain UI metadata. Do not make OpenFIGI itself the BO primary key; use it as one mapping/reference source so KRX/KSD/vendor-specific identifiers can coexist.

### Risks

- OpenFIGI coverage/semantics do not guarantee complete KRX historical mapping.
- Corporate actions can change economic continuity in ways a single predecessor/successor edge cannot express.
- Identifier providers can revise mappings; point-in-time knowledge semantics are still required.
- Over-aggressive automatic mapping is worse than explicit unresolved state.

### Decision

**TEST / REFERENCE.** Implement only as a fixture/schema extension after DI001/DI003 validator work is operational. No trading behavior changes.

---

## EV-008 — Agent Tool Authority & Indirect-Prompt-Injection Boundary

**Status:** TEST / REFERENCE  
**Evidence quality:** A- institutional/security guidance (NIST NCCoE concept paper/RFI) + A- OWASP operational threat guidance; BO-specific enforcement design requires test.

### What is new

NIST's 2026 agent identity/authorization work explicitly separates agent identification, authorization, auditing and non-repudiation, and asks for controls against prompt injection. OWASP's agent-security guidance treats external websites/documents/tool outputs as an indirect-prompt-injection path and highlights tool abuse, privilege escalation, data exfiltration and memory poisoning.

### Comparison with current BO architecture

AIML-007 addresses common-mode model/provider/data/tool failures. EV-006 protects the final order path. Neither defines what an agent is *authorized* to read/write/call before an order exists.

Required boundary:

`agent identity -> capability policy -> scoped credential/tool -> deterministic authorization -> action -> audit trace`

Prompt text may describe policy but must not grant authority.

### Hypothesis H-EV008

A deterministic least-privilege authority layer can prevent malicious retrieved content/tool output from escalating an agent's effective permissions while preserving normal read/research workflows.

### EXP-EV008

In a disposable sandbox, seed indirect injections into web pages, repository text, retrieved evidence and tool output. Attempt unauthorized secret access, cross-path GitHub modification, evidence mutation, state-changing connector actions, memory poisoning, exfiltration and order-gate bypass.

Success criteria:

- seeded privilege/scope escapes blocked: **100%**;
- unauthorized state changes: **0**;
- every denial attributable to `agent_id`, `trace_id`, `policy_version`, requested capability: **100%**;
- allowed benign task completion regression measured separately rather than hidden by the security score.

### Proposed implementation path

Define `bo.agent_authority.v1` as a deterministic policy envelope outside model prompts. Use task-scoped capabilities, read/write separation, narrow resource paths, short-lived credentials where available, explicit high-impact action classes, and immutable authorization-denial evidence. Keep EV-006 order safety independent so a compromised Council still cannot bypass the execution gate.

### Decision

**TEST / REFERENCE.** No credential, connector, production or paper-trading permission changes in this cycle.

---

## Cross-domain scan — reviewed but not promoted

### Design/UX
Recent financial-visualization literature was reviewed, but the actionable findings remain covered by D-003–D-005: semantic labeling, progressive disclosure, accessibility and uncertainty/evidence presentation. **Classification: REFERENCE; no new ID.**

### Quantitative Finance / Evidence
Recent work on stochastic financial ML/DRL evaluation reinforces repeated-seed evaluation, multiplicity controls, transaction-cost realism and falsification against null/reference environments. These materially support EV-003/EV-005/Q-002 rather than justify another overlapping ledger item. **Classification: REFERENCE / REVISIT after harness implementation.**

### AI/ML
FinMCP-Bench (613 tasks, 65 financial MCPs) and FinToolBench (295 tool-required queries, 760 executable financial tools) reinforce AIML-005's decision to evaluate tool selection, call sequencing, timeliness and compliance rather than prose quality alone. FinSkillBench further suggests curated procedural skills can materially change agent performance, which should become an AIML-005 ablation rather than a new architecture commitment. **Classification: REFERENCE; extend EXP-AIML005 later.**

### Product/Competitor
OpenBB continues to position its workspace around governed data, shared analyst/AI workflows and interactive dashboards. This reinforces D-001 and BO's shared-context direction but does not expose a new non-duplicative gap this cycle. **Classification: REFERENCE.**

### Market & Data Infrastructure
Promoted as DI-005 because identity continuity is upstream of existing point-in-time/snapshot controls and is not currently explicit.

### Evidence & Validation
EV-008 is restored to repository traceability. Recent leakage/falsification research reinforces seeded positive controls already planned in DI-003/EV-003/EV-005; no duplicate validation ID was added.

---

## Source register

- OpenFIGI API Documentation, v3 — identifier mapping semantics; FIGI stability; ticker/base-ticker ambiguity.
- U.S. SEC, EDGAR APIs / Accessing EDGAR Data — real-time dissemination, submission/company facts APIs and filing availability timing.
- NIST NCCoE, *Accelerating the Adoption of Software and Artificial Intelligence Agent Identity and Authorization* (2026-02-05).
- OWASP AI Agent Security Cheat Sheet / Agentic AI indirect-prompt-injection guidance.
- FinMCP-Bench (2026), arXiv:2603.24943.
- FinToolBench (2026), arXiv:2603.08262.
- FinSkillBench (2026), arXiv:2608.18099.
- OpenBB Workspace public product documentation/site (reviewed 2026-09-23).
- *Spurious Predictability in Financial Machine Learning* (2026), arXiv:2604.15531 — reference only.
- *When Alpha Disappears: A One-Switch Benchmark for Decision-Time Leakage in Financial Backtests* (2026), arXiv:2605.23959 — reference only.

## Cycle decision and implementation safety

New promoted research: **DI-005**. Restored missing prior research record: **EV-008**. No production trading, paper-trading, credential, connector permission, model routing, strategy ranking or execution behavior was changed.

## Highest-priority next action

Do **not** displace the implementation queue with DI-005. First execute **EXP-DI001 + EXP-DI003** on the KRX seeded-leakage fixture. When that validator exists, add DI-005's canonical-instrument identity fixture to the same replay harness. EV-008 should be tested in a disposable agent/tool sandbox before any broader write-capable autonomous workflow is enabled.