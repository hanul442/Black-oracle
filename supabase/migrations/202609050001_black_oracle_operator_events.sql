-- Black Oracle append-only operator event store.
-- Server-only audit storage. This migration is staged in Git only and is not applied by this PR.

create table if not exists public.black_oracle_operator_events (
  event_id text primary key,
  runtime_id text not null,
  occurred_at timestamptz not null,
  event_type text not null check (event_type in ('CYCLE', 'DECISION', 'EVIDENCE_TRANSITION', 'RISK', 'TRADE', 'SYSTEM', 'INCIDENT')),
  severity text not null check (severity in ('INFO', 'NORMAL', 'WARNING', 'CRITICAL')),
  cycle_number bigint,
  market text,
  state_key text,
  dedupe_key text,
  refs jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists black_oracle_operator_events_runtime_time_idx
  on public.black_oracle_operator_events (runtime_id, occurred_at desc);

create index if not exists black_oracle_operator_events_market_time_idx
  on public.black_oracle_operator_events (runtime_id, market, occurred_at desc)
  where market is not null;

create index if not exists black_oracle_operator_events_severity_time_idx
  on public.black_oracle_operator_events (runtime_id, severity, occurred_at desc);

create index if not exists black_oracle_operator_events_cycle_idx
  on public.black_oracle_operator_events (runtime_id, cycle_number)
  where cycle_number is not null;

alter table public.black_oracle_operator_events enable row level security;

revoke all on table public.black_oracle_operator_events from anon, authenticated;
revoke all on table public.black_oracle_operator_events from public;
grant select, insert on table public.black_oracle_operator_events to service_role;

comment on table public.black_oracle_operator_events is
  'Append-only Black Oracle supervision/audit event stream. Service role only; client roles receive no privileges.';
comment on column public.black_oracle_operator_events.event_id is
  'Deterministic event identity used for idempotent append operations.';
comment on column public.black_oracle_operator_events.state_key is
  'Normalized state fingerprint used to distinguish meaningful state changes from repeated unchanged observations.';
comment on column public.black_oracle_operator_events.dedupe_key is
  'Optional semantic dedupe key for supervision noise suppression; event_id remains the immutable primary key.';
