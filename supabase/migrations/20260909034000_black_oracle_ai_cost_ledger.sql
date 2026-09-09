create table if not exists public.black_oracle_ai_usage (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  feature text not null,
  operation text not null,
  model text not null,
  response_id text,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  cached_input_tokens bigint not null default 0 check (cached_input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  reasoning_tokens bigint not null default 0 check (reasoning_tokens >= 0),
  web_search_calls integer not null default 0 check (web_search_calls >= 0),
  estimated_cost_usd numeric(14, 8) not null default 0 check (estimated_cost_usd >= 0),
  price_book_version text not null,
  trace_id text,
  market text,
  strategy_id text,
  evidence_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_black_oracle_ai_usage_occurred_at
  on public.black_oracle_ai_usage (occurred_at desc);
create index if not exists idx_black_oracle_ai_usage_feature_time
  on public.black_oracle_ai_usage (feature, occurred_at desc);

alter table public.black_oracle_ai_usage enable row level security;
revoke all on table public.black_oracle_ai_usage from anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_ai_usage to service_role;

create table if not exists public.black_oracle_ai_budget (
  id text primary key default 'default',
  monthly_budget_usd numeric(10, 2) not null default 10.00 check (monthly_budget_usd > 0),
  hard_cap_usd numeric(10, 2) not null default 15.00 check (hard_cap_usd >= monthly_budget_usd),
  soft_limit_ratio numeric(5, 4) not null default 0.8000 check (soft_limit_ratio > 0 and soft_limit_ratio < 1),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.black_oracle_ai_budget (id, monthly_budget_usd, hard_cap_usd, soft_limit_ratio, enabled)
values ('default', 10.00, 15.00, 0.8000, true)
on conflict (id) do nothing;

alter table public.black_oracle_ai_budget enable row level security;
revoke all on table public.black_oracle_ai_budget from anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_ai_budget to service_role;

create table if not exists public.black_oracle_strategy_research_hypotheses (
  id text primary key,
  research_date date not null,
  market text not null,
  model text not null,
  response_id text,
  guided_seed integer not null,
  hypotheses jsonb not null default '[]'::jsonb,
  input_scope jsonb not null default '{}'::jsonb,
  blind_metrics_exposed boolean not null default false check (blind_metrics_exposed = false),
  execution_authority boolean not null default false check (execution_authority = false),
  promotion_authority boolean not null default false check (promotion_authority = false),
  created_at timestamptz not null default now()
);

create index if not exists idx_black_oracle_strategy_research_date
  on public.black_oracle_strategy_research_hypotheses (research_date desc, market);

alter table public.black_oracle_strategy_research_hypotheses enable row level security;
revoke all on table public.black_oracle_strategy_research_hypotheses from anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_strategy_research_hypotheses to service_role;
