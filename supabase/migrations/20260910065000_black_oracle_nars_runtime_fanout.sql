-- Runtime-scoped NARS delivery fan-out for shadow / challenger runtimes.
-- IMPORTANT: legacy black_oracle_nars_inbox and black_oracle_external_evidence are
-- intentionally left unchanged so the pinned S1R2 qualification runtime keeps its
-- existing on_conflict=outbox_id contract.

create table if not exists public.black_oracle_nars_runtime_inbox (
  id uuid primary key default gen_random_uuid(),
  runtime_id text not null,
  outbox_id uuid not null,
  event_id uuid,
  packet_type text not null default 'EvidencePacket',
  producer text not null,
  authority text not null,
  execution_authority boolean not null default false check (execution_authority = false),
  payload jsonb not null,
  mapped_markets jsonb not null default '[]'::jsonb,
  status text not null default 'RECEIVED',
  received_at timestamptz not null default now(),
  analyzed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint black_oracle_nars_runtime_inbox_status_check
    check (status in ('RECEIVED', 'MAPPED', 'ANALYZED', 'UNMAPPED', 'REJECTED', 'ERROR')),
  constraint black_oracle_nars_runtime_inbox_runtime_outbox_key
    unique (runtime_id, outbox_id)
);

create index if not exists black_oracle_nars_runtime_inbox_status_idx
  on public.black_oracle_nars_runtime_inbox (runtime_id, status, received_at desc);

create table if not exists public.black_oracle_runtime_external_evidence (
  runtime_id text not null,
  id text not null,
  packet_outbox_id uuid not null,
  event_id uuid,
  market text not null,
  title text not null,
  direction text not null,
  strength numeric not null check (strength >= 0 and strength <= 100),
  reliability numeric not null check (reliability >= 0 and reliability <= 1),
  source_type text not null,
  source text,
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  contradiction_of text,
  tags jsonb not null default '[]'::jsonb,
  rationale text not null,
  materiality numeric not null default 0 check (materiality >= 0 and materiality <= 1),
  impact_confidence numeric not null default 0 check (impact_confidence >= 0 and impact_confidence <= 1),
  evidence_grade text,
  evidence_score numeric,
  citations jsonb not null default '[]'::jsonb,
  analysis_method text not null,
  analysis_model text,
  analysis_version text not null,
  eligible_for_new_risk boolean not null default false,
  execution_authority boolean not null default false check (execution_authority = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (runtime_id, id),
  constraint black_oracle_runtime_external_evidence_direction_check
    check (direction in ('BULLISH', 'BEARISH', 'NEUTRAL')),
  constraint black_oracle_runtime_external_evidence_source_type_check
    check (source_type in ('PRIMARY', 'NEWS', 'MACRO', 'ONCHAIN', 'MARKET', 'ANALYST', 'SYSTEM'))
);

create index if not exists black_oracle_runtime_external_evidence_market_expiry_idx
  on public.black_oracle_runtime_external_evidence (runtime_id, market, expires_at desc);
create index if not exists black_oracle_runtime_external_evidence_packet_idx
  on public.black_oracle_runtime_external_evidence (runtime_id, packet_outbox_id);

alter table public.black_oracle_nars_runtime_inbox enable row level security;
alter table public.black_oracle_runtime_external_evidence enable row level security;
revoke all on table public.black_oracle_nars_runtime_inbox from public, anon, authenticated;
revoke all on table public.black_oracle_runtime_external_evidence from public, anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_nars_runtime_inbox to service_role;
grant select, insert, update, delete on table public.black_oracle_runtime_external_evidence to service_role;

create or replace function public.black_oracle_nars_delivery_candidates(
  p_runtime_id text,
  p_limit integer default 12
)
returns table(id uuid, event_id uuid, payload jsonb, attempts integer)
language sql
stable
set search_path = ''
as $$
  with runtime_start as (
    select coalesce(
      (select r.created_at
       from public.black_oracle_trading_runtime r
       where r.runtime_id = p_runtime_id
       limit 1),
      now() - interval '15 minutes'
    ) as started_at
  )
  select o.id, o.event_id, o.payload, o.attempts
  from public.nars_intel_outbox o
  cross join runtime_start rs
  left join public.black_oracle_nars_runtime_inbox i
    on i.runtime_id = p_runtime_id and i.outbox_id = o.id
  where o.destination = 'black_oracle'
    and o.status in ('pending','sent')
    and o.available_at <= now()
    and o.created_at >= rs.started_at
    and (
      i.outbox_id is null
      or (i.status = 'ERROR' and i.updated_at <= now() - interval '15 minutes')
    )
  order by o.created_at asc
  limit greatest(1, least(coalesce(p_limit,12),50));
$$;

revoke all on function public.black_oracle_nars_delivery_candidates(text,integer) from public, anon, authenticated;
grant execute on function public.black_oracle_nars_delivery_candidates(text,integer) to service_role;

comment on table public.black_oracle_nars_runtime_inbox is
  'Runtime-scoped NARS packet inbox for shadow/challenger runtimes. Leaves the legacy qualification inbox untouched.';
comment on table public.black_oracle_runtime_external_evidence is
  'Runtime-scoped Black Oracle market-impact Evidence derived from NARS packets; execution authority is always false.';
comment on function public.black_oracle_nars_delivery_candidates(text,integer) is
  'Per-runtime NARS fan-out. Sent packets remain replayable to another runtime after its own start time without changing the legacy outbox contract.';
