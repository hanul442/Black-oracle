# BLACK ORACLE Development Operating Cycle

Status: **ACTIVE**
Effective: **2026-09-21**

This document is the persistent operating rule for autonomous BLACK ORACLE development.

## Mandatory cycle

Every development cycle must execute in this order:

1. **PLAN**
   - Read `docs/automation/ACTIVE_SPRINT.md`.
   - Inspect current repository, open PRs, CI and relevant deployment/runtime state.
   - Record the exact work package, acceptance criteria, safety boundary, rollback path and next gate in the active sprint document **before implementation**.

2. **RESEARCH REVIEW**
   - Read the relevant entries in `docs/research/`.
   - Prefer existing BLACK ORACLE research lineage over rediscovering the same material.
   - Record which research IDs, experiments, precedents or prior results affect the current work.
   - Research does not silently change production behavior; it produces a testable implementation constraint or experiment.

3. **IMPLEMENT**
   - Execute the highest-priority unblocked Alpha work package.
   - Keep BOT and BOR product/runtime/database authority separate.
   - Preserve working behavior and frozen safety boundaries.

4. **TEST**
   - Run the smallest complete verification set for the changed surface.
   - For BOT, include typecheck/trading tests/build when applicable.
   - For BOR, include schema, citation, rendering and application tests as they are introduced.

5. **VERIFY**
   - Verify the actual artifact/commit/runtime, not only an HTTP 200 or nominal deployment success.
   - Fail closed when evidence is missing.

6. **DOCUMENT**
   - Update `ACTIVE_SPRINT.md` with completed work, validation evidence, blockers, PR/commit/deployment and exact next checkpoint.
   - Update architecture/research docs if the implementation changes a contract or resolves an experiment.

7. **PR / MERGE / DEPLOY**
   - Use a reviewable atomic PR when code or architecture changes.
   - Merge only when acceptance gates are satisfied.
   - Deployment is optional and must not weaken authority or contaminate protected runtime data.

8. **SLACK REPORT**
   - Post the cycle result to `#black-oracle`.
   - Include: project, sprint/work package, change, tests, PR/commit/deploy status, blocker, Alpha status and single next priority.
   - The cycle is not considered complete until this report is sent.

## Cross-project rules

- BOT and BOR are independent repositories, runtimes and databases.
- BOR never places orders or grants execution authority.
- BOT never depends on BOR availability to preserve risk or execution safety.
- Shared objects must use explicit versioned contracts.
- `NO_TRADE`, missing data, stale data and uncertainty are first-class states.
- Research → Hypothesis → Experiment → Result → Adopt/Reject lineage must remain inspectable.
