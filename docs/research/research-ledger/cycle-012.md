# BLACK ORACLE Research Ledger — Cycle 012

Date: 2026-09-22

## New entry
| ID | Domain | Topic | Evidence | Status | Experiment | Production impact |
|---|---|---|---|---|---|---|
| EV-008 | Evidence/Validation + AI Security | Agent tool authority, identity, least privilege & indirect-prompt-injection containment | A-/B+ NIST + BIS + OWASP | TEST / REFERENCE | EXP-EV008 | None |

## Lineage
`EV-008 -> H-EV008 -> EXP-EV008 -> pending result -> ADOPT / REJECT / REVISIT`

## Authority-boundary rule
Model instructions, retrieved content and tool output are never sources of authority. Agent identity and permissions must be enforced outside the model through versioned capability policy. Each invocation should be attributable to a principal and policy version with explicit tool/resource/action/credential scope. Untrusted external content must not expand authority. State-changing actions require deterministic policy enforcement and auditable allow/deny evidence. Trading remains additionally protected by `bo.order_gate.v1`; agent authority controls do not replace the order gate.

## Duplicate control
This is distinct from AIML-007 and EV-006. AIML-007 measures correlated/common-mode dependency failure. EV-006 constrains final order execution. EV-008 tests whether adversarial external content can hijack an agent's non-trading or upstream tool authority and whether least-privilege controls contain the blast radius.

## Queue insertion
Do not displace the existing implementation-first queue. Run EXP-EV008 after the minimal DI001/DI003 validation fixture and EV006 sandbox boundary exist, reusing the same trace/audit IDs where possible. Before any broader state-changing connector or live-capable agent permissions are granted, EV008 becomes a prerequisite security gate.

## Cycle decision
Recent Quant, Design/UX, observability, market/data and agent-security material was scanned. Robust portfolio/transaction-cost and GenAI observability findings substantially overlapped Q-001/Q-002 and AIML-003/004 and were retained as references rather than new ledger IDs. The non-duplicative gap promoted this cycle is agent identity/authority and indirect-prompt-injection containment because BO increasingly relies on agents consuming external data and tools.

No production or paper-trading behavior changed.

## Highest-priority next action
Continue implementation-first work: EXP-DI001 + EXP-DI003 remains first. Then EV006 sandbox order gate. In parallel with the first disposable agent/tool sandbox, implement the smallest `bo.agent_authority.v1` policy fixture and run EXP-EV008 before expanding state-changing agent permissions.
