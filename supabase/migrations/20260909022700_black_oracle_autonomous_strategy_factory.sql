alter table public.black_oracle_strategy_factory_runs
  add column if not exists factory_version text,
  add column if not exists generation_count integer,
  add column if not exists blind_fraction double precision,
  add column if not exists lifecycle_counts jsonb not null default '{}'::jsonb,
  add column if not exists human_approval_required boolean not null default true;

alter table public.black_oracle_strategy_factory_runs
  drop constraint if exists black_oracle_strategy_factory_runs_human_approval_required_check;
alter table public.black_oracle_strategy_factory_runs
  add constraint black_oracle_strategy_factory_runs_human_approval_required_check
  check (human_approval_required = true);

create table if not exists public.black_oracle_strategy_experiments (
  id text primary key,
  run_id text not null references public.black_oracle_strategy_factory_runs(id) on delete cascade,
  market text not null,
  timeframe_minutes integer not null check (timeframe_minutes in (15,60,240,1440)),
  generation integer not null check (generation > 0),
  seed integer not null,
  hypothesis jsonb not null,
  parent_ids jsonb not null default '[]'::jsonb,
  genome jsonb not null,
  development_validation jsonb not null,
  blind_validation jsonb not null,
  walk_forward_validation jsonb not null,
  stress_validation jsonb not null,
  score double precision not null check (score >= 0 and score <= 100),
  lifecycle text not null check (lifecycle in ('REJECT','INCUBATOR','CHALLENGER','CHAMPION_CANDIDATE')),
  hard_gate_passed boolean not null,
  hard_gate_reasons jsonb not null default '[]'::jsonb,
  fatal_reasons jsonb not null default '[]'::jsonb,
  dimensions jsonb not null default '{}'::jsonb,
  execution_authority boolean not null default false check (execution_authority = false),
  promotion_authority boolean not null default false check (promotion_authority = false),
  requires_human_approval boolean not null default true check (requires_human_approval = true),
  human_review_status text not null default 'NOT_REQUESTED'
    check (human_review_status in ('NOT_REQUESTED','PENDING','APPROVED','REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists black_oracle_strategy_experiments_run_score_idx
  on public.black_oracle_strategy_experiments (run_id, score desc);
create index if not exists black_oracle_strategy_experiments_lifecycle_score_idx
  on public.black_oracle_strategy_experiments (lifecycle, score desc);
create index if not exists black_oracle_strategy_experiments_market_created_idx
  on public.black_oracle_strategy_experiments (market, created_at desc);

alter table public.black_oracle_strategy_experiments enable row level security;
revoke all on table public.black_oracle_strategy_experiments from public, anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_strategy_experiments to service_role;

comment on table public.black_oracle_strategy_experiments is
  'Candidate-level Experiment Ledger for autonomous Strategy Factory research. Research may classify candidates, but execution, Champion promotion, capital changes, and LIVE deployment always require separate human authority.';
comment on column public.black_oracle_strategy_experiments.lifecycle is
  'Research disposition only: REJECT / INCUBATOR / CHALLENGER / CHAMPION_CANDIDATE. CHAMPION_CANDIDATE is never an automatic Champion promotion.';
