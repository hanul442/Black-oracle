create table if not exists public.nars_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  source_type text not null check (source_type in ('rss','api','filing','government','research','newsletter','social','other')),
  endpoint text,
  country text,
  language text,
  tier smallint not null default 2 check (tier between 0 and 5),
  enabled boolean not null default true,
  health_status text not null default 'unknown' check (health_status in ('unknown','up','degraded','down','disabled')),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nars_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.nars_sources(id) on delete restrict,
  external_id text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  title text not null,
  canonical_url text not null,
  normalized_title text not null,
  dedup_key text not null unique,
  language text,
  is_breaking boolean not null default false,
  excerpt text,
  content_hash text,
  raw_metadata jsonb not null default '{}'::jsonb,
  ingest_version text not null default '4.0.0-foundation',
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table if not exists public.nars_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  title text not null,
  status text not null default 'detected' check (status in ('detected','emerging','confirmed','developing','stabilized','resolved','archived')),
  priority_score numeric(5,2) not null default 0 check (priority_score between 0 and 100),
  evidence_grade text,
  summary text,
  first_detected_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.nars_event_documents (
  event_id uuid not null references public.nars_events(id) on delete cascade,
  document_id uuid not null references public.nars_documents(id) on delete cascade,
  relation text not null default 'supporting' check (relation in ('supporting','contradicting','context','primary')),
  confidence numeric(5,4) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (event_id, document_id)
);

create table if not exists public.nars_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  job_key text,
  status text not null check (status in ('queued','running','succeeded','failed','dead')),
  started_at timestamptz,
  finished_at timestamptz,
  attempt integer not null default 0 check (attempt >= 0),
  items_in integer not null default 0 check (items_in >= 0),
  items_out integer not null default 0 check (items_out >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.nars_errors (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  component text not null,
  error_code text,
  message text not null,
  retryable boolean not null default false,
  source_id uuid references public.nars_sources(id) on delete set null,
  job_run_id uuid references public.nars_job_runs(id) on delete set null,
  context jsonb not null default '{}'::jsonb
);

create table if not exists public.nars_intel_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.nars_events(id) on delete set null,
  destination text not null default 'black_oracle',
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.nars_system_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.nars_system_meta(key, value)
values ('schema_version', jsonb_build_object('version','4.0.0-foundation','sprint','N4-01'))
on conflict (key) do update set value = excluded.value, updated_at = now();

create index if not exists nars_documents_published_at_idx on public.nars_documents (published_at desc);
create index if not exists nars_documents_source_retrieved_idx on public.nars_documents (source_id, retrieved_at desc);
create index if not exists nars_events_status_priority_idx on public.nars_events (status, priority_score desc, last_updated_at desc);
create index if not exists nars_errors_occurred_at_idx on public.nars_errors (occurred_at desc);
create index if not exists nars_job_runs_created_at_idx on public.nars_job_runs (created_at desc);
create index if not exists nars_intel_outbox_pending_idx on public.nars_intel_outbox (status, available_at) where status in ('pending','failed');

alter table public.nars_sources enable row level security;
alter table public.nars_documents enable row level security;
alter table public.nars_events enable row level security;
alter table public.nars_event_documents enable row level security;
alter table public.nars_job_runs enable row level security;
alter table public.nars_errors enable row level security;
alter table public.nars_intel_outbox enable row level security;
alter table public.nars_system_meta enable row level security;

revoke all on table public.nars_sources from anon, authenticated;
revoke all on table public.nars_documents from anon, authenticated;
revoke all on table public.nars_events from anon, authenticated;
revoke all on table public.nars_event_documents from anon, authenticated;
revoke all on table public.nars_job_runs from anon, authenticated;
revoke all on table public.nars_errors from anon, authenticated;
revoke all on table public.nars_intel_outbox from anon, authenticated;
revoke all on table public.nars_system_meta from anon, authenticated;
revoke all on sequence public.nars_errors_id_seq from anon, authenticated;

grant select, insert, update, delete on table public.nars_sources to service_role;
grant select, insert, update, delete on table public.nars_documents to service_role;
grant select, insert, update, delete on table public.nars_events to service_role;
grant select, insert, update, delete on table public.nars_event_documents to service_role;
grant select, insert, update, delete on table public.nars_job_runs to service_role;
grant select, insert, update, delete on table public.nars_errors to service_role;
grant select, insert, update, delete on table public.nars_intel_outbox to service_role;
grant select, insert, update, delete on table public.nars_system_meta to service_role;
grant usage, select on sequence public.nars_errors_id_seq to service_role;
