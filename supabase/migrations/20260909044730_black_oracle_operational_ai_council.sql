create table if not exists public.black_oracle_ai_council_reviews (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  runtime_id text not null,
  market text not null,
  decision_timestamp timestamptz not null,
  reviewed_action text not null check (reviewed_action in ('ENTER','EXIT','HOLD','NO_TRADE')),
  deterministic_verdict text not null check (deterministic_verdict in ('APPROVE','CONDITIONAL','REJECT')),
  deterministic_counts jsonb not null default '{}'::jsonb,
  escalation_reason text not null,
  model text not null,
  ai_stance text not null check (ai_stance in ('AGREE','CAUTION','DISSENT')),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  rationale text not null,
  concerns jsonb not null default '[]'::jsonb,
  what_would_change_mind text not null default '',
  advisory_only boolean not null default true check (advisory_only = true),
  execution_authority boolean not null default false check (execution_authority = false),
  created_at timestamptz not null default now()
);

create index if not exists idx_black_oracle_ai_council_market_time
  on public.black_oracle_ai_council_reviews (market, decision_timestamp desc);
create index if not exists idx_black_oracle_ai_council_created
  on public.black_oracle_ai_council_reviews (created_at desc);

alter table public.black_oracle_ai_council_reviews enable row level security;
revoke all on table public.black_oracle_ai_council_reviews from public, anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_ai_council_reviews to service_role;

comment on table public.black_oracle_ai_council_reviews is
  'Post-decision AI Shadow Council adjudications. Reviews are advisory only and can never create, alter, approve, reject, resize, promote, or execute a trade.';
