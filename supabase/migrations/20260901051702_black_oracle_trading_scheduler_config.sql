-- Black Oracle Trading scheduler control plane.
-- Operational Vault values and cron job registration are intentionally not committed.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.black_oracle_trading_scheduler_config (
  runtime_id text primary key,
  enabled boolean not null default false,
  target_base_url text,
  last_invoked_at timestamptz,
  last_http_status integer,
  last_ok boolean,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.black_oracle_trading_scheduler_config enable row level security;

revoke all on table public.black_oracle_trading_scheduler_config
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.black_oracle_trading_scheduler_config
  to service_role;

insert into public.black_oracle_trading_scheduler_config (runtime_id, enabled)
values ('black-oracle-paper', false)
on conflict (runtime_id) do nothing;

comment on table public.black_oracle_trading_scheduler_config is
  'Server-only scheduler target and telemetry for Black Oracle Paper Trading.';
