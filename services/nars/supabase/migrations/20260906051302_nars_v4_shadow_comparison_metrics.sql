drop view if exists public.nars_shadow_metrics_v1;
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
  obs.v3_first_seen_at,
  obs.collector_first_seen_at,
  case
    when obs.v3_first_seen_at is not null and obs.collector_first_seen_at is not null
    then extract(epoch from (obs.collector_first_seen_at - obs.v3_first_seen_at))
    else null
  end as collector_minus_v3_seconds,
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
    max(ds.last_seen_at) as last_seen_at,
    min(ds.first_seen_at) filter (where ds.origin = 'v3_shadow') as v3_first_seen_at,
    min(ds.first_seen_at) filter (where ds.origin = 'collector') as collector_first_seen_at
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

create view public.nars_shadow_metrics_v1
with (security_invoker = true) as
with doc as (
  select
    d.id,
    d.is_breaking,
    min(ds.first_seen_at) filter (where ds.origin = 'v3_shadow') as v3_first_seen_at,
    min(ds.first_seen_at) filter (where ds.origin = 'collector') as collector_first_seen_at
  from public.nars_documents d
  left join public.nars_document_sightings ds on ds.document_id = d.id
  group by d.id, d.is_breaking
), agg as (
  select
    count(*) as total_documents,
    count(*) filter (where v3_first_seen_at is not null and collector_first_seen_at is null) as v3_only,
    count(*) filter (where collector_first_seen_at is not null and v3_first_seen_at is null) as collector_only,
    count(*) filter (where v3_first_seen_at is not null and collector_first_seen_at is not null) as both_count,
    count(*) filter (where is_breaking) as breaking_documents,
    avg(extract(epoch from (collector_first_seen_at - v3_first_seen_at)))
      filter (where v3_first_seen_at is not null and collector_first_seen_at is not null) as mean_collector_minus_v3_seconds,
    percentile_cont(0.5) within group (
      order by extract(epoch from (collector_first_seen_at - v3_first_seen_at))
    ) filter (where v3_first_seen_at is not null and collector_first_seen_at is not null) as median_collector_minus_v3_seconds
  from doc
)
select
  total_documents,
  v3_only,
  collector_only,
  both_count,
  breaking_documents,
  case when (v3_only + collector_only + both_count) > 0
    then both_count::numeric / (v3_only + collector_only + both_count)::numeric
    else null end as overlap_rate,
  mean_collector_minus_v3_seconds,
  median_collector_minus_v3_seconds,
  now() as generated_at
from agg;

revoke all on public.nars_shadow_metrics_v1 from anon, authenticated;
grant select on public.nars_shadow_metrics_v1 to service_role;

insert into public.nars_system_meta(key, value, updated_at)
values ('schema_version', '{"version":"4.0.2-shadow","sprint":"N4-02"}'::jsonb, now())
on conflict (key) do update
set value = excluded.value, updated_at = now();
