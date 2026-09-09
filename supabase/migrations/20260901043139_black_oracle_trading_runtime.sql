-- Black Oracle Trading runtime checkpoints.
-- Server-only storage: browser/client roles intentionally receive no table privileges.

create table if not exists public.black_oracle_trading_runtime (
  runtime_id text primary key,
  schema_version integer not null check (schema_version > 0),
  saved_at timestamptz not null,
  reason text not null,
  checkpoint jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists black_oracle_trading_runtime_saved_at_idx
  on public.black_oracle_trading_runtime (saved_at desc);

alter table public.black_oracle_trading_runtime enable row level security;

revoke all on table public.black_oracle_trading_runtime from anon, authenticated;
revoke all on table public.black_oracle_trading_runtime from public;
grant select, insert, update, delete on table public.black_oracle_trading_runtime to service_role;

comment on table public.black_oracle_trading_runtime is
  'Server-side durable checkpoint for Black Oracle Paper Trading runtime. Service role only.';
comment on column public.black_oracle_trading_runtime.runtime_id is
  'Stable runtime identifier, allowing isolated Paper sessions without sharing state.';
comment on column public.black_oracle_trading_runtime.checkpoint is
  'Versioned Black Oracle TradingRuntimeCheckpoint JSON payload.';
