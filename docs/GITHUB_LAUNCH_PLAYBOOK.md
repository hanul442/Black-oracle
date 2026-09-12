# BLACK ORACLE GitHub Launch Playbook

Status: pre-launch execution plan
Goal: maximize qualified discovery, stars, forks, discussion, and contributor conversion without overstating investment performance.

## Positioning

Primary category:

**AI Investment Operating System**

Primary one-liner:

> An auditable AI investment operating system that connects evidence, strategy selection, multi-agent review, deterministic risk, Paper execution, and outcomes through replayable decision lineage.

Short social version:

> Evidence → Strategies → AI Council → Risk → Execution → Outcome. Every important decision is replayable.

Avoid leading with:

- “guaranteed profitable AI trader”,
- “AI hedge fund beating the market”,
- unqualified monthly-return claims,
- live-capital autonomy that does not exist yet.

## Launch blockers

Do not start the external launch burst until all items below are resolved.

- [ ] Public-code license selected and added
- [ ] README merged to `main`
- [ ] GitHub repository description updated
- [ ] GitHub Topics applied
- [ ] Social Preview uploaded
- [ ] public demo URL stable enough for strangers
- [ ] demo contains no private credentials/data
- [ ] README screenshots/GIF added
- [ ] `npm install` + documented quick start verified on a clean environment
- [ ] CI/build green on launch commit
- [ ] no secrets detected in repository history/current tree
- [ ] private Alpha boundary reviewed
- [ ] release/tag prepared

## Recommended repository description

`Auditable AI investment operating system — evidence, strategy routing, multi-agent Council, deterministic risk, Paper execution and Decision Replay.`

Keep the description focused on what exists rather than future promises.

## Recommended Topics

GitHub supports repository topics for discovery. Suggested initial set:

- `algorithmic-trading`
- `quantitative-finance`
- `ai-agents`
- `multi-agent-systems`
- `fintech`
- `trading-system`
- `risk-management`
- `backtesting`
- `decision-intelligence`
- `portfolio-management`
- `llm`
- `typescript`
- `react`
- `supabase`

Do not use irrelevant high-volume topics merely for reach.

## Social Preview specification

Recommended canvas: **1280 × 640**.

Content hierarchy:

```text
BLACK ORACLE

AI INVESTMENT OPERATING SYSTEM

Evidence → Strategy → Council → Risk → Execution → Outcome

Every decision. Replayable.
```

Visual direction:

- high-end institutional fintech,
- dark or near-black neutral background,
- real BLACK ORACLE interface crop or restrained abstract lineage graphic,
- no fake PnL numbers,
- no candlestick “get rich” visual language,
- readable at small social-card size,
- one focal message only.

## README media

The README should eventually include two media assets near the top:

1. **15–25 second product GIF/video**
   - Oracle market state
   - open Decision
   - show Council / Arbiter / Risk
   - open Replay
   - show Outcome linkage

2. **architecture graphic**
   - Evidence/NARS
   - Strategy Factory
   - Router
   - Council / Red Team
   - Arbiter
   - Risk
   - Paper execution
   - Outcome
   - Canonical Ledger / Replay

The demo should prove the product faster than paragraphs can explain it.

## Public demo path

A first-time visitor should be able to understand the unique value in under 60 seconds.

Preferred demo flow:

```text
Open demo
  ↓
Select a recorded Paper decision
  ↓
See strategy + evidence
  ↓
See Council / Red Team / Arbiter
  ↓
See deterministic Risk
  ↓
See order/fill or NO_TRADE
  ↓
Replay lineage
  ↓
See realized outcome / calibration when available
```

A recorded/read-only showcase is acceptable for launch and safer than exposing operational controls.

## v0.1 Public Preview release

Suggested release title:

**BLACK ORACLE v0.1 — Public Preview**

Suggested release note:

> BLACK ORACLE is an experimental AI investment operating system built around auditable decision lineage. This public preview exposes the architecture connecting evidence, strategy selection, an evidence-gated multi-agent Council, deterministic Risk, Paper execution, outcomes, and Decision Replay.
>
> The focus of v0.1 is not a profitability claim. It is making an autonomous-investment stack inspectable: what did the system know, why did it act or refuse to act, which authority layer made each decision, and what happened afterward?
>
> Current development remains centered on PAPER qualification, runtime integrity, calibration, and prospective evaluation. AI Council authority remains shadow-only.

Key highlights:

- Decision Replay v2
- Canonical Event Ledger
- Strategy Factory / Router architecture
- AI Council v3 + Independent Red Team
- evidence-gated Arbiter
- deterministic Risk sovereignty
- crypto PAPER + KRX PAPER paths
- runtime integrity and qualification-cohort safeguards
- mobile Oracle / Decision / Replay / Outcome surface

## Seven-day launch burst

The goal is not to spam every channel. The goal is to create a concentrated window in which technically relevant people discover the same coherent story.

### D-2 to D-1 — readiness

- merge launch PR
- verify clean install
- verify demo
- upload Social Preview
- apply Topics
- prepare release
- prepare 20-second demo media
- prepare launch posts
- verify no sensitive Alpha/secrets are public

### D0 — GitHub launch

Publish release and update repository home.

Primary CTA:

> Explore the architecture, replay a decision, and tell me where the audit chain can be broken.

This is stronger than asking strangers only for stars.

### D0/D1 — technical launch channels

Post to a small number of relevant places with channel-native framing:

- Hacker News / Show HN — engineering and system-design story
- Reddit quant/algotrading/LocalLLaMA-style relevant communities — methodology and multi-agent evaluation angle
- X — visual demo + architecture
- LinkedIn — product/research build narrative
- Korean developer/quant communities — Korean summary with technical link

Follow each community's self-promotion rules. Do not coordinate fake engagement or ask people to manipulate Trending.

### D2 — technical deep dive

Publish one strong engineering article:

**“Why an AI trading system needs Decision Replay more than another agent.”**

Cover lineage, shadow authority, deterministic Risk, missing-data semantics, and outcome calibration.

### D3 — Council / Red Team deep dive

Publish:

**“We removed majority voting from our AI investment Council.”**

Explain Round 0 independence, Red Team, revisions, Arbiter, and why confidence averaging is dangerous.

### D4 — reliability deep dive

Publish:

**“A trading engine should survive its database failing.”**

Explain atomic checkpoint rollback, scheduler/persistence telemetry, fail-closed new risk, and audit preservation.

### D5 — contributor invitation

Open 5–10 sharply scoped `good first issue` / `research` issues.

Good examples:

- calibration chart for probability buckets,
- synthetic Decision Replay fixture,
- runtime-integrity UI projection,
- baseline strategy plugin example,
- Council disagreement visualization,
- documentation for local Paper-only setup.

### D6/D7 — evidence-based follow-up

Share actual launch learnings:

- stars/forks/views if available,
- issues opened,
- contributor feedback,
- most-requested feature,
- what was confusing,
- what will change next.

Do not fabricate social proof.

## Conversion funnel

Optimize for this sequence:

```text
Impression
 → repository visit
 → understands project in 10 sec
 → sees demo
 → trusts technical depth
 → Star
 → tries locally / reads architecture
 → issue/discussion
 → contribution
```

Stars are an output of comprehension and credibility, not the product itself.

## Metrics to track

For the launch window, record daily:

- total stars and net new stars,
- forks,
- unique visitors / clones if available,
- release views/downloads if applicable,
- demo sessions,
- issue/discussion count,
- external referral source,
- contributor conversion,
- README-to-demo click-through if measurable.

Do not optimize blindly for raw stars if they do not convert into users, technical feedback, or contributors.

## Trending strategy principles

GitHub does not publish a simple guaranteed formula for Trending. Treat Trending as a possible consequence of concentrated authentic interest, not something that can be directly configured.

Therefore:

- create a polished public surface before the burst,
- concentrate the launch instead of leaking the announcement over many weeks,
- give people a demoable technical idea worth sharing,
- make the repository easy to understand and run,
- create legitimate reasons to star/fork/contribute,
- avoid fake stars, paid manipulation, bot engagement, or coordinated abuse.

## Post-launch roadmap

After the initial launch, maintain momentum with meaningful releases rather than promotional noise.

Candidate public milestones:

- Decision Replay fixture/demo pack
- Strategy plugin SDK/interface
- Council prospective-evaluation dashboard
- Runtime Integrity surface
- public Paper benchmark dataset
- qualification report format
- first external contributor release

Each release should have a concrete technical story.
