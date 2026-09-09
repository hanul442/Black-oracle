create table if not exists public.black_oracle_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  runtime_id text,
  event_type text not null check (event_type in ('SYSTEM','EVIDENCE','STRATEGY','COUNCIL','DECISION','RISK','ORDER','TRADE','OUTCOME','EXPERIMENT','AI')),
  event_name text not null,
  market text,
  strategy_id text,
  strategy_version text,
  action text,
  summary text not null,
  reason text,
  severity text not null default 'INFO' check (severity in ('INFO','WARN','ERROR','CRITICAL')),
  authority text not null default 'observed',
  execution_authority boolean not null default false,
  source text not null,
  trace jsonb not null default '{}'::jsonb,
  links jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1 check (schema_version > 0)
);

create index if not exists black_oracle_events_occurred_idx on public.black_oracle_events (occurred_at desc);
create index if not exists black_oracle_events_type_occurred_idx on public.black_oracle_events (event_type, occurred_at desc);
create index if not exists black_oracle_events_market_occurred_idx on public.black_oracle_events (market, occurred_at desc) where market is not null;
create index if not exists black_oracle_events_runtime_occurred_idx on public.black_oracle_events (runtime_id, occurred_at desc) where runtime_id is not null;

alter table public.black_oracle_events enable row level security;
revoke all on public.black_oracle_events from anon, authenticated;
grant select, insert on public.black_oracle_events to service_role;

create or replace function public.black_oracle_events_reject_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'black_oracle_events is append-only; UPDATE/DELETE is prohibited';
end;
$$;

revoke all on function public.black_oracle_events_reject_mutation() from public, anon, authenticated;
grant execute on function public.black_oracle_events_reject_mutation() to service_role;

drop trigger if exists black_oracle_events_append_only on public.black_oracle_events;
create trigger black_oracle_events_append_only
before update or delete on public.black_oracle_events
for each row execute function public.black_oracle_events_reject_mutation();
