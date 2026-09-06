create table if not exists public.nars_document_sightings (
  document_id uuid not null references public.nars_documents(id) on delete cascade,
  origin text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 1 check (seen_count > 0),
  legacy_ref text,
  metadata jsonb not null default '{}'::jsonb,
  primary key (document_id, origin),
  constraint nars_document_sightings_origin_check check (origin in ('collector','v3_shadow','manual'))
);

create index if not exists nars_document_sightings_origin_last_seen_idx
  on public.nars_document_sightings(origin, last_seen_at desc);

alter table public.nars_document_sightings enable row level security;
revoke all on public.nars_document_sightings from anon, authenticated;
grant select, insert, update, delete on public.nars_document_sightings to service_role;

insert into public.nars_document_sightings(document_id, origin, first_seen_at, last_seen_at, seen_count, legacy_ref, metadata)
select id, ingest_origin, retrieved_at, retrieved_at, 1, legacy_ref, jsonb_build_object('backfilled', true)
from public.nars_documents
on conflict (document_id, origin) do nothing;

drop view if exists public.nars_live_wire_v1;

create view public.nars_live_wire_v1
with (security_invoker = true) as
select
  d.id,
  d.published_at,
  d.retrieved_at,
  d.title,
  d.canonical_url,
  d.language,
  d.is_breaking,
  d.ingest_origin,
  d.legacy_ref,
  s.source_key,
  s.name as source_name,
  s.source_type,
  s.tier as source_tier,
  s.health_status as source_health,
  coalesce(obs.origins, array[]::text[]) as sighting_origins,
  coalesce(obs.v3_seen, false) as v3_seen,
  coalesce(obs.collector_seen, false) as collector_seen,
  obs.first_seen_at,
  obs.last_seen_at,
  ev.event_id,
  ev.event_title,
  ev.event_status,
  ev.priority_score,
  ev.evidence_grade
from public.nars_documents d
join public.nars_sources s on s.id = d.source_id
left join lateral (
  select
    array_agg(ds.origin order by ds.origin) as origins,
    bool_or(ds.origin = 'v3_shadow') as v3_seen,
    bool_or(ds.origin = 'collector') as collector_seen,
    min(ds.first_seen_at) as first_seen_at,
    max(ds.last_seen_at) as last_seen_at
  from public.nars_document_sightings ds
  where ds.document_id = d.id
) obs on true
left join lateral (
  select
    e.id as event_id,
    e.title as event_title,
    e.status as event_status,
    e.priority_score,
    e.evidence_grade
  from public.nars_event_documents ed
  join public.nars_events e on e.id = ed.event_id
  where ed.document_id = d.id
  order by e.last_updated_at desc
  limit 1
) ev on true;

revoke all on public.nars_live_wire_v1 from anon, authenticated;
grant select on public.nars_live_wire_v1 to service_role;

insert into public.nars_system_meta(key, value, updated_at)
values ('schema_version', '{"version":"4.0.1-shadow","sprint":"N4-02"}'::jsonb, now())
on conflict (key) do update
set value = excluded.value, updated_at = now();
