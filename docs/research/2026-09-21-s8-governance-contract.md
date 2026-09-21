# BOT-S8 Council / Red Team / Arbiter Governance — Research Review

Date: 2026-09-21
Status: IMPLEMENTATION GATE

## Constraints reviewed
- **AIML-002 / EXP-AIML002:** AI decision provenance and TEVV require explicit traceable evidence; model prose is not authority.
- **AIML-003 / EXP-AIML003:** Council/Router trace envelopes remain vendor-neutral and replayable; S8 records canonical source/evidence IDs rather than provider-specific hidden state.
- **AIML-004 / EXP-AIML004:** external GenAI telemetry is an adapter; BO governance identity remains canonical.
- **AIML-005 / EXP-AIML005:** financial-agent quality remains TEST; S8 does not adopt model-performance claims or confidence cutoffs.
- **AIML-006 / EXP-AIML006:** Council topology is experimental. S8 implements a deterministic evidence boundary, not a claim that multi-agent debate improves returns.
- **DI-003 / EXP-DI003:** governance cannot repair stale/non-point-in-time evidence; freshness is explicit and fail-closed.
- **DI-004 / EXP-DI004:** evidence fingerprints and source IDs must remain snapshot-addressable/replayable.
- **EV-006 / EXP-EV006:** bounded autonomy requires a separately testable deterministic pre-trade gate. S8 cannot bypass deterministic Risk/order safety controls.
- **S7 precedent:** Router `NO_TRADE` is an explicit fail-closed proposal outcome and cannot be upgraded downstream by governance.

## Hypothesis — BOT-S8-H1
A small deterministic governance envelope can preserve Council/Red-Team provenance and make veto, disagreement, missing/stale evidence and identity mismatch resolve explicitly to `NO_TRADE`, without giving agents or the Arbiter trading authority.

## Experiment — BOT-S8-E1
Implement `bot.governance-decision.v1`. It consumes one S7 Router decision and explicit Council + Red Team findings. Router `NO_TRADE` remains terminal. A Router `SELECT` can become governance `APPROVE` only when both findings are fresh, match the selected strategy identity, carry non-empty source/evidence identity, Council verdict is `APPROVE`, and Red Team verdict is `CLEAR`. All other bounded evidence states resolve `NO_TRADE` or reject malformed/authority-escalating input.

## Production boundary
This is an authority-free contract. It cannot place/cancel/resize orders, allocate capital, replace Champion, mutate PAPER, access broker secrets, bypass deterministic Risk, or enable LIVE. `APPROVE` means governance evidence is internally sufficient for the next deterministic gate; it is not execution authorization.

## Disposition before implementation
**PROCEED WITH BOUNDED CONTRACT.** No research threshold/model parameter is adopted. Merge requires deterministic tests and both required repository CI workflows green.
