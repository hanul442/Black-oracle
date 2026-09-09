create table if not exists public.black_oracle_instrument_aliases (
  market text primary key,
  asset_class text not null,
  symbol text not null,
  display_name text not null,
  aliases jsonb not null default '[]'::jsonb,
  source text not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  execution_authority boolean not null default false check (execution_authority = false),
  updated_at timestamptz not null default now(),
  check (market ~ '^(KRX-[0-9]{6}|KRW-[A-Z0-9]+)$')
);

create index if not exists idx_black_oracle_instrument_aliases_expires
  on public.black_oracle_instrument_aliases (expires_at desc);
create index if not exists idx_black_oracle_instrument_aliases_asset
  on public.black_oracle_instrument_aliases (asset_class, expires_at desc);

alter table public.black_oracle_instrument_aliases enable row level security;
revoke all on table public.black_oracle_instrument_aliases from public, anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_instrument_aliases to service_role;

comment on table public.black_oracle_instrument_aliases is
  'Dynamic market/name alias registry used only for deterministic Evidence entity resolution. Rows never grant execution authority.';
