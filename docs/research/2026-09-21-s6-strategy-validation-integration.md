# BOT-S6 Strategy Factory Validation Integration — Research Review

Date: 2026-09-21
Status: IMPLEMENTATION GATE

## Research → Hypothesis → Experiment → Result → Adopt/Reject

### Research constraints reviewed
- **DI-001 / EXP-DI001:** Strategy Factory must consume the canonical validation experiment identity rather than create a parallel promotion ledger.
- **DI-003 / EXP-DI003:** candidate evidence inherits the point-in-time safety of the canonical manifest; the binding cannot repair unsafe historical inputs.
- **DI-004 / EXP-DI004:** exact snapshot/experiment lineage must remain replayable.
- **EV-001 / EXP-EV001:** engine/result identity is validation evidence, not a Strategy Factory score.
- **EV-002 / EXP-EV002:** robustness evidence stays separate from performance ranking. S6 must not translate metrics into hidden ranking thresholds.
- **EV-003 / EXP-EV003 and EV-005 / EXP-EV005:** DSR/PBO and trial-family accounting remain TEST; no numerical cutoff is adopted here.
- **Q-002 / EXP-Q002:** execution-cost stress remains a required canonical validation stage, but S6 does not invent a cost threshold.

### Existing implementation precedent
`AutonomousStrategyEvaluation` currently computes legacy research lifecycle labels and explicitly carries `requiresHumanApproval=true`, `executionAuthority=false`, and `promotionAuthority=false`. S6 does not rewrite that evaluator. Instead it adds an independent canonical evidence binding that can say whether a candidate has complete PASS validation lineage.

### Hypothesis — BOT-S6-H1
A minimal immutable binding from candidate strategy identity to `bot.validation-evaluation.v1` can prevent validation-free promotion eligibility without granting promotion or execution authority and without changing PAPER behavior.

### Experiment — BOT-S6-E1
Implement an authority-free `bot.strategy-validation-binding.v1` contract that:
1. requires exact candidate strategy ID/revision and experiment ID,
2. accepts only a canonical validation evaluation with matching experiment identity,
3. maps `PASS` to `validationEligible=true` and every other status to false,
4. preserves stage-result fingerprints for audit/replay,
5. rejects authority escalation and malformed identities.

### Production boundary
This is evidence/review plumbing only. No candidate is promoted, no Champion is replaced, no Router/Risk decision changes, no capital is allocated, and no PAPER/LIVE order path changes. Research thresholds remain research.

### Disposition before implementation
**PROCEED WITH BOUNDED CONTRACT.** Adoption is contingent on deterministic tests and required repository CI. The contract is not itself evidence that any strategy has alpha.
