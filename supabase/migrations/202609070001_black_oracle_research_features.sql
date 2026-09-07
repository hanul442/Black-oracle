-- Black Oracle Shadow Research observations and future outcomes.
-- Server-only, append-oriented storage. Production trading does not read these
-- tables for entry, sizing, routing, stop, or take-profit authority.

create table if not exists public.research_feature_observations (
  id text primary key,
  cycle_id text not null,
  observed_at timestamptz not null,
  market text not null,
  timeframe text not null check (timeframe in ('4H', '1H', '15M')),
  feature_family text not null,
  feature_name text not null,
  feature_version text not null,
  raw_value double precision,
  normalized_value double precision,
  direction text not null,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  status text not null,
  strategy_version text not null,
  code_commit text not null,
  config_version text not null,
  provenance text not null check (provenance in ('PROSPECTIVE', 'RECONSTRUCTED')),
  reference_price double precision not null check (reference_price > 0),
  execution_decision text not null check (execution_decision in ('ENTER', 'EXIT', 'HOLD', 'NO_TRADE')),
  evidence_score double precision,
  evidence_confidence double precision not null check (evidence_confidence >= 0 and evidence_confidence <= 1),
  oracle_trade_score double precision not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.research_feature_outcomes (
  observation_id text not null references public.research_feature_observations(id) on delete restrict,
  horizon text not null check (horizon in ('15M', '1H', '4H', '24H')),
  future_return double precision not null,
  mfe double precision not null,
  mae double precision not null,
  resolved_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (observation_id, horizon)
);

create index if not exists research_feature_observations_market_time_idx
  on public.research_feature_observations (market, observed_at desc);
create index if not exists research_feature_observations_feature_idx
  on public.research_feature_observations (feature_name, timeframe, observed_at desc);
create index if not exists research_feature_observations_cycle_idx
  on public.research_feature_observations (cycle_id);
create index if not exists research_feature_outcomes_resolved_idx
  on public.research_feature_outcomes (resolved_at desc);

alter table public.research_feature_observations enable row level security;
alter table public.research_feature_outcomes enable row level security;

revoke all on table public.research_feature_observations from anon, authenticated, public;
revoke all on table public.research_feature_outcomes from anon, authenticated, public;

-- Service role may append/read research data. UPDATE/DELETE are intentionally
-- not granted so the canonical SQL research tables remain append-only.
grant select, insert on table public.research_feature_observations to service_role;
grant select, insert on table public.research_feature_outcomes to service_role;

comment on table public.research_feature_observations is
  'Append-only SHADOW research observations. No production execution authority.';
comment on table public.research_feature_outcomes is
  'Future outcomes resolved strictly after observation time for OOS/prospective evaluation.';
