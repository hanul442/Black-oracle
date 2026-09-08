create table if not exists public.black_oracle_nars_inbox (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null unique,
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
  constraint black_oracle_nars_inbox_status_check
    check (status in ('RECEIVED', 'MAPPED', 'ANALYZED', 'UNMAPPED', 'REJECTED', 'ERROR'))
);

create table if not exists public.black_oracle_external_evidence (
  id text primary key,
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
  constraint black_oracle_external_evidence_direction_check
    check (direction in ('BULLISH', 'BEARISH', 'NEUTRAL')),
  constraint black_oracle_external_evidence_source_type_check
    check (source_type in ('PRIMARY', 'NEWS', 'MACRO', 'ONCHAIN', 'MARKET', 'ANALYST', 'SYSTEM'))
);

create index if not exists black_oracle_nars_inbox_status_received_idx
  on public.black_oracle_nars_inbox (status, received_at desc);
create index if not exists black_oracle_external_evidence_market_expiry_idx
  on public.black_oracle_external_evidence (market, expires_at desc);
create index if not exists black_oracle_external_evidence_packet_idx
  on public.black_oracle_external_evidence (packet_outbox_id);

alter table public.black_oracle_nars_inbox enable row level security;
alter table public.black_oracle_external_evidence enable row level security;
revoke all on table public.black_oracle_nars_inbox from public, anon, authenticated;
revoke all on table public.black_oracle_external_evidence from public, anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_nars_inbox to service_role;
grant select, insert, update, delete on table public.black_oracle_external_evidence to service_role;

comment on table public.black_oracle_nars_inbox is
  'Immutable-ish delivery inbox for NARS EvidencePackets. Packets remain evidence-only and have no execution authority.';
comment on table public.black_oracle_external_evidence is
  'Black Oracle market-impact analyses derived only from delivered NARS EvidencePackets. New-risk eligibility is explicit and auditable.';
