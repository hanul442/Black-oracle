create table if not exists public.black_oracle_evidence_requests (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  runtime_id text not null,
  market text not null,
  asset_class text not null,
  aliases jsonb not null default '[]'::jsonb,
  status text not null default 'PENDING',
  trigger text not null,
  reason text not null,
  decision_id text,
  strategy_id text,
  minimum_active_evidence integer not null default 1 check (minimum_active_evidence > 0),
  requested_at timestamptz not null default now(),
  required_by timestamptz not null,
  last_attempt_at timestamptz,
  fulfilled_at timestamptz,
  evidence_ids jsonb not null default '[]'::jsonb,
  execution_authority boolean not null default false check (execution_authority = false),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint black_oracle_evidence_requests_asset_class_check
    check (asset_class in ('CRYPTO_SPOT', 'CRYPTO_PERP', 'EQUITY', 'UNKNOWN')),
  constraint black_oracle_evidence_requests_status_check
    check (status in ('PENDING', 'ACQUIRING', 'FULFILLED', 'FAILED', 'CANCELLED')),
  constraint black_oracle_evidence_requests_trigger_check
    check (trigger in ('ENTRY_CANDIDATE', 'MANUAL', 'UNIVERSE_DISCOVERY'))
);

create index if not exists black_oracle_evidence_requests_status_requested_idx
  on public.black_oracle_evidence_requests (status, requested_at desc);

create index if not exists black_oracle_evidence_requests_market_requested_idx
  on public.black_oracle_evidence_requests (market, requested_at desc);

alter table public.black_oracle_evidence_requests enable row level security;
revoke all on table public.black_oracle_evidence_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_evidence_requests to service_role;

comment on table public.black_oracle_evidence_requests is
  'Black Oracle requests for NARS coverage when a candidate decision lacks active source-backed evidence. This table has no execution authority.';
