create table if not exists public.black_oracle_strategy_factory_runs (
  id text primary key,
  market text not null,
  timeframe_minutes integer not null check (timeframe_minutes in (15,60,240,1440)),
  bars integer not null check (bars > 0),
  candidate_count integer not null check (candidate_count > 0),
  seed integer not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  status_counts jsonb not null default '{}'::jsonb,
  top_results jsonb not null default '[]'::jsonb,
  execution_authority boolean not null default false check (execution_authority = false),
  promotion_authority boolean not null default false check (promotion_authority = false),
  created_at timestamptz not null default now()
);
create index if not exists black_oracle_strategy_factory_runs_market_finished_idx
  on public.black_oracle_strategy_factory_runs (market, finished_at desc);
alter table public.black_oracle_strategy_factory_runs enable row level security;
revoke all on table public.black_oracle_strategy_factory_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_strategy_factory_runs to service_role;
comment on table public.black_oracle_strategy_factory_runs is
  'Deterministic Strategy Factory research tournaments. Runs never grant execution or automatic promotion authority.';
